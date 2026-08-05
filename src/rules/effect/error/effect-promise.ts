/**
 * @file Reports Effect.promise calls that turn Promise rejections into defects.
 */

import { isNamedMemberCall } from "../../utils/ast-refinement/index.js";
import { createRule } from "../../utils/create-rule.js";
import { PRINCIPLE_URL } from "../../utils/principles.js";

/**
 * Enforces the `effect-promise` Agent Code Guard rule.
 */
export const effectPromise = createRule({
  name: "effect-promise",
  meta: {
    type: "problem",
    docs: {
      description:
        "`Promise<T>` inside an `Effect` re-introduces the erased error channel; convert at the boundary.",
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
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
        if (!isNamedMemberCall(node, "Effect", "promise")) {
          return;
        }
        context.report({ node, messageId: "effectPromise" });
      },
    };
  },
});
