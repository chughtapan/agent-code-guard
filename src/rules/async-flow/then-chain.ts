import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

export default createRule({
  name: "then-chain",
  meta: {
    type: "problem",
    docs: {
      description: "`.then()` chains hide the error channel and reorder control flow; same erasure as `Promise<T>`.",
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
    },
    messages: {
      thenChain:
        "Promise .then() chain — compose with Effect.flatMap / Effect.map",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== AST_NODE_TYPES.MemberExpression) return;
        const prop = callee.property;
        if (
          prop.type === AST_NODE_TYPES.Identifier &&
          prop.name === "then" &&
          !callee.computed
        ) {
          context.report({ node, messageId: "thenChain" });
        }
      },
    };
  },
});
