import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { isTestFile } from "../utils/is-test-file.js";
import { getEnclosingFunctionName } from "../utils/ast-refinement.js";

const ERROR_CTORS = new Set(["Error", "TypeError", "RangeError"]);

export default createRule({
  name: "no-raw-throw-new-error",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag `throw new Error(...)` (and TypeError/RangeError) in non-test code. Return a tagged error or Effect.fail instead.",
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
    if (isTestFile(context.filename)) return {};
    return {
      ThrowStatement(node) {
        const arg = node.argument;
        if (arg.type !== AST_NODE_TYPES.NewExpression) return;
        if (arg.callee.type !== AST_NODE_TYPES.Identifier) return;
        const ctor = arg.callee.name;
        if (!ERROR_CTORS.has(ctor)) return;
        const fnName = getEnclosingFunctionName(node);
        if (fnName && fnName.startsWith("absurd")) return;
        context.report({
          node,
          messageId: "rawThrow",
          data: { ctor },
        });
      },
    };
  },
});
