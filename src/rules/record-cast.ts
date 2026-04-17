import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

function isStringKeyword(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSStringKeyword;
}

function isUnknownKeyword(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSUnknownKeyword;
}

export default createRule({
  name: "record-cast",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag `as Record<string, unknown>` casts. Use typed results instead.",
    },
    messages: {
      recordCast:
        "Unsafe Record<string, unknown> cast — use typed results",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      TSAsExpression(node) {
        const target = node.typeAnnotation;
        if (target.type !== AST_NODE_TYPES.TSTypeReference) return;
        if (
          target.typeName.type !== AST_NODE_TYPES.Identifier ||
          target.typeName.name !== "Record"
        ) {
          return;
        }
        const params = target.typeArguments?.params;
        if (!params || params.length !== 2) return;
        if (!isStringKeyword(params[0]!)) return;
        if (!isUnknownKeyword(params[1]!)) return;
        context.report({ node, messageId: "recordCast" });
      },
    };
  },
});
