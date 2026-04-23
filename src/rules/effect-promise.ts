import { createRule } from "../utils/create-rule.js";
import { isNamedMemberCall } from "../utils/ast-refinement.js";

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
        if (!isNamedMemberCall(node, "Effect", "promise")) return;
        context.report({ node, messageId: "effectPromise" });
      },
    };
  },
});
