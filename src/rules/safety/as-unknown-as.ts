import { type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

function isUnknownKeyword(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSUnknownKeyword;
}

function isCastToUnknown(
  node: TSESTree.Expression,
): node is TSESTree.TSAsExpression | TSESTree.TSTypeAssertion {
  return (
    (node.type === AST_NODE_TYPES.TSAsExpression || node.type === AST_NODE_TYPES.TSTypeAssertion) &&
    isUnknownKeyword(node.typeAnnotation)
  );
}

/**
 * Enforces the `as-unknown-as` Agent Code Guard rule.
 */
export const asUnknownAs = createRule({
  name: "as-unknown-as",
  meta: {
    type: "problem",
    docs: {
      description:
        "`as unknown as T` is a double-cast that bypasses the type system at the boundary; decode through a schema.",
      url: PRINCIPLE_URL.VALIDATE_AT_BOUNDARY,
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
    function maybeReport(node: TSESTree.TSAsExpression | TSESTree.TSTypeAssertion): void {
      if (!isCastToUnknown(node.expression)) {
        return;
      }
      context.report({ node, messageId: "asUnknownAs" });
    }

    return {
      TSAsExpression: maybeReport,
      TSTypeAssertion: maybeReport,
    };
  },
});
