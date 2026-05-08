import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

function isUnknownKeyword(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSUnknownKeyword;
}

function isCastToUnknown(
  node: TSESTree.Expression,
): node is TSESTree.TSAsExpression | TSESTree.TSTypeAssertion {
  return (
    (node.type === AST_NODE_TYPES.TSAsExpression ||
      node.type === AST_NODE_TYPES.TSTypeAssertion) &&
    isUnknownKeyword(node.typeAnnotation)
  );
}

export default createRule({
  name: "as-unknown-as",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag `as unknown as` cast chains. Use a real decoder, type guard, or typed constructor instead.",
    },
    messages: {
      asUnknownAs:
        "`as unknown as` bypasses the type system — replace it with a type guard, schema decode, or typed constructor.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function maybeReport(
      node: TSESTree.TSAsExpression | TSESTree.TSTypeAssertion,
    ): void {
      if (!isCastToUnknown(node.expression)) return;
      context.report({ node, messageId: "asUnknownAs" });
    }

    return {
      TSAsExpression: maybeReport,
      TSTypeAssertion: maybeReport,
    };
  },
});
