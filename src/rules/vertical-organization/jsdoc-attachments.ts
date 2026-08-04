/**
 * @file Attaches JSDoc blocks to immediately following supported declarations
 * and derives exact symbol or callable candidates for filler detection.
 */

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";

/** Captures names available to template matching for an attached declaration. */
export interface AttachedCandidates {
  readonly symbol?: string;
  readonly callable?: string;
  readonly represents: boolean;
}

function parentOrSelf(node: TSESTree.Node): TSESTree.Node | undefined {
  return node.parent ?? undefined;
}

// eslint-disable-next-line complexity, sonarjs/cyclomatic-complexity -- AST export wrappers require exhaustive unwrapping before finding a declaration.
function declarationFor(node: TSESTree.Node): TSESTree.Node | undefined {
  let current: TSESTree.Node | undefined = node;
  while (current !== undefined) {
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- Only declaration-bearing nodes can attach JSDoc prose.
    switch (current.type) {
      case AST_NODE_TYPES.ExportNamedDeclaration:
      case AST_NODE_TYPES.ExportDefaultDeclaration:
        current = current.declaration ?? parentOrSelf(current);
        break;
      case AST_NODE_TYPES.FunctionDeclaration:
      case AST_NODE_TYPES.ClassDeclaration:
      case AST_NODE_TYPES.MethodDefinition:
      case AST_NODE_TYPES.VariableDeclaration:
      case AST_NODE_TYPES.TSTypeAliasDeclaration:
      case AST_NODE_TYPES.TSInterfaceDeclaration:
        return current;
      default:
        current = parentOrSelf(current);
    }
  }
  return undefined;
}

function leadingNode(declaration: TSESTree.Node): TSESTree.Node {
  const parent = declaration.parent;
  if (parent === undefined) {
    return declaration;
  }
  if (parent.type === AST_NODE_TYPES.ExportNamedDeclaration) {
    return parent;
  }
  return parent.type === AST_NODE_TYPES.ExportDefaultDeclaration ? parent : declaration;
}

function isImmediateLeadingComment(
  sourceCode: TSESLint.SourceCode,
  token: TSESLint.AST.Token,
  declaration: TSESTree.Node,
): boolean {
  const leading = leadingNode(declaration);
  const last = sourceCode.getCommentsBefore(leading).at(-1);
  return last !== undefined && last.range[0] === token.range[0];
}

// eslint-disable-next-line complexity, sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity -- This is a quote-aware signature state machine.
function matchingParen(text: string, opening: number): number | undefined {
  let depth = 1;
  let quote: string | undefined;
  let escaped = false;
  for (let index = opening + 1; text[index] !== undefined; index += 1) {
    const character = text[index];
    if (quote !== undefined) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return undefined;
}

function callableFromRange(
  sourceCode: TSESLint.SourceCode,
  symbol: string,
  start: number,
  end: number,
): string | undefined {
  const openingOffset = sourceCode.text.slice(start, end).indexOf("(");
  if (openingOffset === -1) {
    return undefined;
  }
  const opening = start + openingOffset;
  const closing = matchingParen(sourceCode.text, opening);
  return closing === undefined
    ? undefined
    : `${symbol}${sourceCode.text.slice(opening, closing + 1)}`;
}

function afterTypeParameters(
  declaration: { readonly typeParameters?: { readonly range: readonly [number, number] } },
  fallback: number,
): number {
  return declaration.typeParameters?.range[1] ?? fallback;
}

function functionCandidates(
  sourceCode: TSESLint.SourceCode,
  declaration: TSESTree.FunctionDeclaration,
): AttachedCandidates | undefined {
  return declaration.id === null
    ? undefined
    : {
        symbol: declaration.id.name,
        callable: callableFromRange(
          sourceCode,
          declaration.id.name,
          afterTypeParameters(declaration, declaration.id.range[1]),
          declaration.range[1],
        ),
        represents: false,
      };
}

function methodCandidates(
  sourceCode: TSESLint.SourceCode,
  declaration: TSESTree.MethodDefinition,
): AttachedCandidates | undefined {
  if (declaration.computed || (declaration.key.type !== AST_NODE_TYPES.Identifier && declaration.key.type !== AST_NODE_TYPES.PrivateIdentifier)) {
    return undefined;
  }
  return {
    symbol: declaration.key.name,
    callable: callableFromRange(
      sourceCode,
      declaration.key.name,
      afterTypeParameters(declaration.value, declaration.key.range[1]),
      declaration.value.range[1],
    ),
    represents: false,
  };
}

function variableCandidates(
  sourceCode: TSESLint.SourceCode,
  declaration: TSESTree.VariableDeclaration,
): AttachedCandidates | undefined {
  if (declaration.declarations.length !== 1) {
    return undefined;
  }
  const declarator = declaration.declarations[0];
  if (declarator.id.type !== AST_NODE_TYPES.Identifier) {
    return undefined;
  }
  const initializer = declarator.init;
  const callable = initializer !== null &&
    (initializer.type === AST_NODE_TYPES.ArrowFunctionExpression || initializer.type === AST_NODE_TYPES.FunctionExpression)
    ? callableFromRange(
      sourceCode,
      declarator.id.name,
      afterTypeParameters(initializer, initializer.range[0]),
      initializer.range[1],
    )
    : undefined;
  return { symbol: declarator.id.name, callable, represents: true };
}

function representedCandidates(
  declaration: TSESTree.ClassDeclaration | TSESTree.TSTypeAliasDeclaration | TSESTree.TSInterfaceDeclaration,
): AttachedCandidates | undefined {
  return declaration.id === null
    ? undefined
    : { symbol: declaration.id.name, callable: undefined, represents: true };
}

function candidatesFor(
  sourceCode: TSESLint.SourceCode,
  declaration: TSESTree.Node,
): AttachedCandidates | undefined {
  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- Unsupported declaration kinds intentionally have no candidate set.
  switch (declaration.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
      return functionCandidates(sourceCode, declaration);
    case AST_NODE_TYPES.MethodDefinition:
      return methodCandidates(sourceCode, declaration);
    case AST_NODE_TYPES.VariableDeclaration:
      return variableCandidates(sourceCode, declaration);
    case AST_NODE_TYPES.ClassDeclaration:
    case AST_NODE_TYPES.TSTypeAliasDeclaration:
    case AST_NODE_TYPES.TSInterfaceDeclaration:
      return representedCandidates(declaration);
    default:
      return undefined;
  }
}

/**
 * Finds the declaration immediately documented by a JSDoc token.
 * @param sourceCode Source text and AST lookup services for the current file.
 * @param token Candidate JSDoc block-comment token.
 * @returns Closed template candidates for the immediately attached declaration.
 */
export function attachmentFor(
  sourceCode: TSESLint.SourceCode,
  token: TSESLint.AST.Token,
): AttachedCandidates | undefined {
  const following = sourceCode.getTokenAfter(token);
  if (following === null) {
    return undefined;
  }
  const candidate = sourceCode.getNodeByRangeIndex(following.range[0]);
  const declaration = candidate === null ? undefined : declarationFor(candidate);
  return declaration === undefined || !isImmediateLeadingComment(sourceCode, token, declaration)
    ? undefined
    : candidatesFor(sourceCode, declaration);
}
