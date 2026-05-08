import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

function isStringKeyword(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSStringKeyword;
}

function isUnknownKeyword(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSUnknownKeyword;
}

function isRecordTypeReference(
  node: TSESTree.TypeNode,
): node is TSESTree.TSTypeReference {
  return node.type === AST_NODE_TYPES.TSTypeReference &&
    node.typeName.type === AST_NODE_TYPES.Identifier &&
    node.typeName.name === "Record";
}

function isRecordStringUnknownCast(node: TSESTree.TSAsExpression): boolean {
  const target = node.typeAnnotation;
  if (!isRecordTypeReference(target)) return false;
  const params = target.typeArguments?.params;
  if (!params || params.length !== 2) return false;
  return isStringKeyword(params[0]!) && isUnknownKeyword(params[1]!);
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
        if (!isRecordStringUnknownCast(node)) return;
        context.report({ node, messageId: "recordCast" });
      },
    };
  },
});
