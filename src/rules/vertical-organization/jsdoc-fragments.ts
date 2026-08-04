import { type Block, type Line, type Spec, parse } from "comment-parser";
import { AST_NODE_TYPES, type TSESTree, type TSESLint } from "@typescript-eslint/utils";

export type DescriptionKind = "block" | "tag";

export interface DescriptionSpan {
  readonly kind: DescriptionKind;
  readonly tag: string | undefined;
  readonly tagName: string | undefined;
  readonly text: string;
  readonly range: readonly [number, number];
  readonly loc: TSESTree.SourceLocation;
}

export interface AttachedCandidates {
  readonly symbol: string | undefined;
  readonly callable: string | undefined;
  readonly represents: boolean;
}

export interface ParsedJsdocTag {
  readonly tag: string;
  readonly name: string;
  readonly description: DescriptionSpan | undefined;
}

export interface ParsedJsdocBlock {
  readonly token: TSESLint.AST.Token;
  readonly description: DescriptionSpan | undefined;
  readonly tags: readonly ParsedJsdocTag[];
  readonly attachment: AttachedCandidates | undefined;
}

const TOKEN_FIELDS = [
  "start",
  "delimiter",
  "postDelimiter",
  "tag",
  "postTag",
  "type",
  "postType",
  "name",
  "postName",
  "description",
  "end",
  "lineEnd",
] as const;

const NAMED_TAGS = new Set(["param", "arg", "argument", "property", "prop"]);

interface MappedLine {
  readonly line: Line;
  readonly ranges: Readonly<Record<(typeof TOKEN_FIELDS)[number], readonly [number, number]>>;
}

interface Piece {
  readonly text: string;
  readonly range: readonly [number, number];
}

function mapLines(source: string, token: TSESLint.AST.Token, block: Block): readonly MappedLine[] {
  let cursor = token.range[0];
  return block.source.map((line, index) => {
    const ranges: Partial<Record<(typeof TOKEN_FIELDS)[number], readonly [number, number]>> = {};
    for (const field of TOKEN_FIELDS) {
      const value = line.tokens[field];
      const start = cursor;
      cursor += value.length;
      ranges[field] = [start, cursor];
    }
    const lineEnd = cursor;
    const expected = source.slice(lineEnd - line.source.length, lineEnd);
    if (expected !== line.source) {
      cursor = token.range[1];
    } else if (index < block.source.length - 1) {
      if (source[cursor] === "\r" && source[cursor + 1] === "\n") {
        cursor += 2;
      } else if (source[cursor] === "\n" || source[cursor] === "\r") {
        cursor += 1;
      }
    }
    return {
      line,
      ranges: ranges as Readonly<Record<(typeof TOKEN_FIELDS)[number], readonly [number, number]>>,
    };
  });
}

function spanFromPieces(
  sourceCode: TSESLint.SourceCode,
  kind: DescriptionKind,
  tag: string | undefined,
  tagName: string | undefined,
  pieces: readonly Piece[],
): DescriptionSpan | undefined {
  const nonEmpty = pieces.filter((piece) => /\S/u.test(piece.text));
  const first = nonEmpty.at(0);
  const last = nonEmpty.at(-1);
  if (first === undefined || last === undefined) {
    return undefined;
  }
  const startOffset = first.text.search(/\S/u);
  const endOffset = last.text.search(/\s*$/u);
  const range: readonly [number, number] = [
    first.range[0] + startOffset,
    last.range[0] + endOffset,
  ];
  return {
    kind,
    tag,
    tagName,
    text: pieces.filter((piece) => piece.text !== "").map((piece) => piece.text).join("\n"),
    range,
    loc: {
      start: sourceCode.getLocFromIndex(range[0]),
      end: sourceCode.getLocFromIndex(range[1]),
    },
  };
}

function descriptionPiece(mapped: MappedLine): Piece {
  return {
    text: mapped.line.tokens.description,
    range: mapped.ranges.description,
  };
}

function blockDescription(
  sourceCode: TSESLint.SourceCode,
  block: Block,
  mapped: readonly MappedLine[],
): DescriptionSpan | undefined {
  if (block.problems.length > 0) {
    return undefined;
  }
  const firstTag = mapped.findIndex((line) => line.line.tokens.tag !== "");
  const descriptionLines = firstTag === -1 ? mapped : mapped.slice(0, firstTag);
  return spanFromPieces(
    sourceCode,
    "block",
    undefined,
    undefined,
    descriptionLines.map(descriptionPiece),
  );
}

function tagDescription(
  sourceCode: TSESLint.SourceCode,
  spec: Spec,
  mapped: readonly MappedLine[],
): DescriptionSpan | undefined {
  if (spec.problems.length > 0) {
    return undefined;
  }
  const tagLine = mapped.find((line) => line.line.tokens.tag !== "");
  if (tagLine === undefined) {
    return undefined;
  }
  const continuationLines = mapped.slice(mapped.indexOf(tagLine) + 1);
  const pieces = NAMED_TAGS.has(spec.tag)
    ? mapped.map(descriptionPiece)
    : [
        {
          text:
            tagLine.line.tokens.name +
            tagLine.line.tokens.postName +
            tagLine.line.tokens.description,
          range: [tagLine.ranges.name[0], tagLine.ranges.description[1]] as const,
        },
        ...continuationLines.map(descriptionPiece),
      ];
  return spanFromPieces(sourceCode, "tag", spec.tag, NAMED_TAGS.has(spec.tag) ? spec.name : undefined, pieces);
}

function isJSDoc(token: TSESLint.AST.Token, sourceCode: TSESLint.SourceCode): boolean {
  return token.type === "Block" && sourceCode.text.slice(token.range[0], token.range[1]).startsWith("/**");
}

function parentOrSelf(node: TSESTree.Node): TSESTree.Node | undefined {
  const parent = node.parent;
  return parent === undefined || parent === null ? undefined : parent;
}

function declarationFor(node: TSESTree.Node): TSESTree.Node | undefined {
  let current: TSESTree.Node | undefined = node;
  while (current !== undefined) {
    switch (current.type) {
      case AST_NODE_TYPES.ExportNamedDeclaration:
      case AST_NODE_TYPES.ExportDefaultDeclaration:
        if (current.declaration !== null) {
          current = current.declaration;
          continue;
        }
        current = parentOrSelf(current);
        continue;
      case AST_NODE_TYPES.FunctionDeclaration:
      case AST_NODE_TYPES.ClassDeclaration:
      case AST_NODE_TYPES.TSEnumDeclaration:
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

function isImmediateLeadingComment(
  sourceCode: TSESLint.SourceCode,
  token: TSESLint.AST.Token,
  declaration: TSESTree.Node,
): boolean {
  const parent = declaration.parent;
  const leading =
    parent !== null &&
    parent !== undefined &&
    (parent.type === AST_NODE_TYPES.ExportNamedDeclaration || parent.type === AST_NODE_TYPES.ExportDefaultDeclaration)
      ? parent
      : declaration;
  const comments = sourceCode.getCommentsBefore(leading);
  const last = comments.at(-1);
  if (last === undefined || last.range[0] !== token.range[0] || last.range[1] !== token.range[1]) {
    return false;
  }
  const next = sourceCode.getTokenAfter(token, { includeComments: false });
  return next !== null && next.range[0] >= leading.range[0];
}

function matchingParen(text: string, opening: number): number | undefined {
  let depth = 0;
  let quote: string | undefined;
  let escaped = false;
  for (let index = opening; index < text.length; index += 1) {
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
  const opening = sourceCode.text.indexOf("(", start);
  if (opening === -1 || opening >= end) {
    return undefined;
  }
  const closing = matchingParen(sourceCode.text, opening);
  if (closing === undefined || closing >= end) {
    return undefined;
  }
  return `${symbol}${sourceCode.text.slice(opening, closing + 1)}`;
}

function attachmentFor(
  sourceCode: TSESLint.SourceCode,
  token: TSESLint.AST.Token,
): AttachedCandidates | undefined {
  const following = sourceCode.getTokenAfter(token, { includeComments: false });
  if (following === null) {
    return undefined;
  }
  const candidate = sourceCode.getNodeByRangeIndex(following.range[0]);
  if (candidate === null) {
    return undefined;
  }
  const declaration = declarationFor(candidate);
  if (declaration === undefined || !isImmediateLeadingComment(sourceCode, token, declaration)) {
    return undefined;
  }
  switch (declaration.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
      return declaration.id === null
        ? undefined
        : {
            symbol: declaration.id.name,
            callable: callableFromRange(
              sourceCode,
              declaration.id.name,
              declaration.id.range[1],
              declaration.range[1],
            ),
            represents: false,
          };
    case AST_NODE_TYPES.MethodDefinition:
      if (declaration.computed || (declaration.key.type !== AST_NODE_TYPES.Identifier && declaration.key.type !== AST_NODE_TYPES.PrivateIdentifier)) {
        return undefined;
      }
      return {
        symbol: declaration.key.name,
        callable: callableFromRange(
          sourceCode,
          declaration.key.name,
          declaration.key.range[1],
          declaration.value.range[1],
        ),
        represents: false,
      };
    case AST_NODE_TYPES.VariableDeclaration: {
      if (declaration.declarations.length !== 1) {
        return undefined;
      }
      const declarator = declaration.declarations[0];
      if (declarator.id.type !== AST_NODE_TYPES.Identifier) {
        return undefined;
      }
      const initializer = declarator.init;
      const callable =
        initializer !== null &&
        (initializer.type === AST_NODE_TYPES.ArrowFunctionExpression ||
          initializer.type === AST_NODE_TYPES.FunctionExpression)
          ? callableFromRange(sourceCode, declarator.id.name, initializer.range[0], initializer.range[1])
          : undefined;
      return { symbol: declarator.id.name, callable, represents: true };
    }
    case AST_NODE_TYPES.ClassDeclaration:
    case AST_NODE_TYPES.TSTypeAliasDeclaration:
    case AST_NODE_TYPES.TSInterfaceDeclaration:
      return declaration.id === null
        ? undefined
        : { symbol: declaration.id.name, callable: undefined, represents: true };
    case AST_NODE_TYPES.TSEnumDeclaration:
      return declaration.id === null
        ? undefined
        : { symbol: declaration.id.name, callable: undefined, represents: false };
    default:
      return undefined;
  }
}

/**
 * Parses one JSDoc token using comment-parser's physical token offsets.
 * @param sourceCode
 * @param token
 */
export function parseJsdocBlock(
  sourceCode: TSESLint.SourceCode,
  token: TSESLint.AST.Token,
): ParsedJsdocBlock | undefined {
  if (!isJSDoc(token, sourceCode)) {
    return undefined;
  }
  const source = sourceCode.text.slice(token.range[0], token.range[1]);
  const blocks = parse(source, { startLine: token.loc.start.line, spacing: "preserve" });
  const block = blocks.at(0);
  if (block === undefined) {
    return undefined;
  }
  const mapped = mapLines(sourceCode.text, token, block);
  return {
    token,
    description: blockDescription(sourceCode, block, mapped),
    tags: block.tags.map((spec) => ({
      tag: spec.tag,
      name: spec.name,
      description: tagDescription(
        sourceCode,
        spec,
        spec.source.map((line) => mapped.find((entry) => entry.line.number === line.number)).filter(
          (entry): entry is MappedLine => entry !== undefined,
        ),
      ),
    })),
    attachment: attachmentFor(sourceCode, token),
  };
}

/**
 * Parses every JSDoc block comment in a source file.
 * @param sourceCode
 */
export function parseJsdocBlocks(sourceCode: TSESLint.SourceCode): readonly ParsedJsdocBlock[] {
  return sourceCode
    .getAllComments()
    .filter((token) => isJSDoc(token, sourceCode))
    .map((token) => parseJsdocBlock(sourceCode, token))
    .filter((block): block is ParsedJsdocBlock => block !== undefined);
}
