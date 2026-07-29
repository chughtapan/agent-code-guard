/**
 * @file Google-style type-shape rules that have no exact maintained-rule
 * equivalent.
 */

import { type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

function isUndefinedType(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSUndefinedKeyword;
}

function isUndefinedUnion(node: TSESTree.TypeNode): boolean {
  if (node.type !== AST_NODE_TYPES.TSUnionType) {
    return false;
  }
  return node.types.some(isUndefinedType);
}

function containsNullishUnion(node: TSESTree.TypeNode): boolean {
  if (node.type !== AST_NODE_TYPES.TSUnionType) {
    return false;
  }
  return node.types.some(
    (member) =>
      member.type === AST_NODE_TYPES.TSNullKeyword ||
      member.type === AST_NODE_TYPES.TSUndefinedKeyword ||
      containsNullishUnion(member),
  );
}

const PARAMETER_OWNER_TYPES: ReadonlySet<string> = new Set([
  AST_NODE_TYPES.ArrowFunctionExpression,
  AST_NODE_TYPES.FunctionDeclaration,
  AST_NODE_TYPES.FunctionExpression,
  AST_NODE_TYPES.TSCallSignatureDeclaration,
  AST_NODE_TYPES.TSConstructorType,
  AST_NODE_TYPES.TSConstructSignatureDeclaration,
  AST_NODE_TYPES.TSDeclareFunction,
  AST_NODE_TYPES.TSEmptyBodyFunctionExpression,
  AST_NODE_TYPES.TSFunctionType,
  AST_NODE_TYPES.TSIndexSignature,
  AST_NODE_TYPES.TSMethodSignature,
]);

const PARAMETER_WRAPPER_TYPES: ReadonlySet<string> = new Set([
  AST_NODE_TYPES.AssignmentPattern,
  AST_NODE_TYPES.RestElement,
  AST_NODE_TYPES.TSParameterProperty,
]);

function isParameterOwner(
  node: TSESTree.Node,
): node is TSESTree.Node & { readonly params: readonly TSESTree.Parameter[] } {
  return PARAMETER_OWNER_TYPES.has(node.type) && "params" in node;
}

function functionOwnsParameter(node: TSESTree.Parameter): boolean {
  let current: TSESTree.Node = node;
  while (current.parent !== undefined) {
    const parent: TSESTree.Node = current.parent;
    if (isParameterOwner(parent)) {
      const candidate = current;
      return parent.params.some((parameter) => parameter === candidate);
    }
    if (!PARAMETER_WRAPPER_TYPES.has(parent.type)) {
      return false;
    }
    current = parent;
  }
  return false;
}

/**
 * Rejects nullable and undefined unions embedded in type aliases so absence is
 * handled at the concrete use site.
 */
export const noNullishTypeAliases = createRule({
  name: "no-nullish-type-aliases",
  meta: {
    type: "problem",
    docs: {
      description:
        "Nullable aliases spread absence across layers; attach null or undefined only at the concrete use site.",
      url: PRINCIPLE_URL.TYPES_BEAT_TESTS,
    },
    messages: {
      nullishAlias:
        "Type aliases must not include null or undefined unions; add absence only where the alias is used.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      TSTypeAliasDeclaration(node) {
        if (!containsNullishUnion(node.typeAnnotation)) {
          return;
        }
        context.report({ node: node.typeAnnotation, messageId: "nullishAlias" });
      },
    };
  },
});

/**
 * Requires optional fields and parameters instead of spelling optionality as
 * a union with undefined.
 */
export const preferOptionalOverUndefinedUnion = createRule({
  name: "prefer-optional-over-undefined-union",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Optional fields and parameters encode omission directly instead of forcing callers to pass undefined.",
      url: PRINCIPLE_URL.TYPES_BEAT_TESTS,
    },
    messages: {
      preferOptional:
        "Use optional syntax (`?`) for fields and parameters instead of `| undefined`.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function reportAnnotation(optional: boolean, annotation?: TSESTree.TSTypeAnnotation): void {
      if (optional || annotation === undefined) {
        return;
      }
      if (!isUndefinedUnion(annotation.typeAnnotation)) {
        return;
      }
      context.report({ node: annotation, messageId: "preferOptional" });
    }

    function reportParameter(
      node: TSESTree.ArrayPattern | TSESTree.Identifier | TSESTree.ObjectPattern,
    ): void {
      if (!functionOwnsParameter(node)) {
        return;
      }
      reportAnnotation(node.optional, node.typeAnnotation);
    }

    return {
      AccessorProperty(node) {
        reportAnnotation(node.optional, node.typeAnnotation);
      },
      ArrayPattern: reportParameter,
      Identifier: reportParameter,
      ObjectPattern: reportParameter,
      PropertyDefinition(node) {
        reportAnnotation(node.optional, node.typeAnnotation);
      },
      TSAbstractAccessorProperty(node) {
        reportAnnotation(node.optional, node.typeAnnotation);
      },
      TSAbstractPropertyDefinition(node) {
        reportAnnotation(node.optional, node.typeAnnotation);
      },
      TSPropertySignature(node) {
        reportAnnotation(node.optional, node.typeAnnotation);
      },
    };
  },
});
