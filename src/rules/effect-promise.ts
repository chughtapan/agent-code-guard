import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

export default createRule({
  name: "effect-promise",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag `Effect.promise(...)`. Use `Effect.tryPromise({ try, catch })` so rejections stay in the typed error channel.",
    },
    messages: {
      effectPromise:
        "Effect.promise() swallows rejections as defects — use Effect.tryPromise({ try, catch }).",
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
        if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.computed) {
          return;
        }
        if (
          callee.object.type !== AST_NODE_TYPES.Identifier ||
          callee.object.name !== "Effect"
        ) {
          return;
        }
        if (
          callee.property.type !== AST_NODE_TYPES.Identifier ||
          callee.property.name !== "promise"
        ) {
          return;
        }
        context.report({ node, messageId: "effectPromise" });
      },
    };
  },
});
