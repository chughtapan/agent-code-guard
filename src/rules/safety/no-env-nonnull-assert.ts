import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

function isProcessEnvMemberExpression(node: TSESTree.Node): boolean {
  if (node.type !== AST_NODE_TYPES.MemberExpression) return false;
  if (node.computed) return false;
  if (node.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (node.object.name !== "process") return false;
  if (node.property.type !== AST_NODE_TYPES.Identifier) return false;
  return node.property.name === "env";
}

export default createRule({
  name: "no-env-nonnull-assert",
  meta: {
    type: "problem",
    docs: {
      description: "`process.env.X!` silences TypeScript without validating the value; environment is a boundary, validated at boot.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#2-validate-at-every-boundary--schemas-where-data-enters-types-inside",
    },
    messages: {
      envNonNullAssert:
        "Non-null assertion on process.env access; validate or default the value at the boundary instead.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      TSNonNullExpression(node) {
        const inner = node.expression;
        if (inner.type !== AST_NODE_TYPES.MemberExpression) return;
        if (!isProcessEnvMemberExpression(inner.object)) return;
        context.report({ node, messageId: "envNonNullAssert" });
      },
    };
  },
});
