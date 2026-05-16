import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

function isStringLiteralType(node: TSESTree.TypeNode): boolean {
  return (
    node.type === AST_NODE_TYPES.TSLiteralType &&
    node.literal.type === AST_NODE_TYPES.Literal &&
    typeof node.literal.value === "string"
  );
}

export default createRule({
  name: "no-manual-enum-cast",
  meta: {
    type: "problem",
    docs: {
      description: "Hand-written unions drift from their source; generated or schema-derived enums do not.",
      url: PRINCIPLE_URL.TYPES_BEAT_TESTS,
    },
    messages: {
      manualEnumCast:
        "Manual string-union cast — import the generated enum type instead",
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
        if (target.type !== AST_NODE_TYPES.TSUnionType) return;
        if (!target.types.every(isStringLiteralType)) return;
        context.report({ node, messageId: "manualEnumCast" });
      },
    };
  },
});
