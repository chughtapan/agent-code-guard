/**
 * @file Prohibits throwing newly constructed built-in Error types, directing
 * failures into typed error channels.
 */

import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { isTestFile } from "../utils/is-test-file.js";
import { getEnclosingFunctionName } from "../utils/ast-refinement/index.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

const ERROR_CTORS = new Set(["Error", "TypeError", "RangeError"]);

/**
 * Enforces the `no-raw-throw-new-error` Agent Code Guard rule.
 */
export const noRawThrowNewError = createRule({
  name: "no-raw-throw-new-error",
  meta: {
    type: "problem",
    docs: {
      description:
        '`throw new Error("bad")` has no type, no handling contract, no receipt for the caller; tagged errors do.',
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
    },
    messages: {
      rawThrow:
        "Return a tagged error or Effect.fail; raw `throw new {{ctor}}` erases the error channel and forces callers to catch-all. See docs/rules/no-raw-throw-new-error.md.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    if (isTestFile(context.filename)) {
      return {};
    }
    return {
      ThrowStatement(node) {
        const arg = node.argument;
        if (arg.type !== AST_NODE_TYPES.NewExpression) {
          return;
        }
        if (arg.callee.type !== AST_NODE_TYPES.Identifier) {
          return;
        }
        const ctor = arg.callee.name;
        if (!ERROR_CTORS.has(ctor)) {
          return;
        }
        const fnName = getEnclosingFunctionName(node);
        if (fnName?.startsWith("absurd")) {
          return;
        }
        context.report({
          node,
          messageId: "rawThrow",
          data: { ctor },
        });
      },
    };
  },
});
