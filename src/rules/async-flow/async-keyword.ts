import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

export default createRule({
  name: "async-keyword",
  meta: {
    type: "problem",
    docs: {
      description: "`async`/`await` is the sugar that hides the erased error channel of `Promise<T>`.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#3-errors-are-typed-not-thrown--tagged-errors-or-typed-results-no-raw-throws-no-silent-catches",
    },
    messages: {
      asyncKeyword: "async keyword — prefer Effect.gen / Effect handlers",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function report(node: TSESTree.Node) {
      context.report({ node, messageId: "asyncKeyword" });
    }

    return {
      FunctionDeclaration(node) {
        if (node.async) report(node);
      },
      FunctionExpression(node) {
        if (!node.async) return;
        const parent = node.parent;
        if (
          parent &&
          (parent.type === "MethodDefinition" ||
            (parent.type === "Property" && parent.method))
        ) {
          return;
        }
        report(node);
      },
      ArrowFunctionExpression(node) {
        if (node.async) report(node);
      },
      MethodDefinition(node) {
        if (node.value.type === "FunctionExpression" && node.value.async) {
          report(node);
        }
      },
      Property(node) {
        if (
          node.method &&
          node.value.type === "FunctionExpression" &&
          node.value.async
        ) {
          report(node);
        }
      },
    };
  },
});
