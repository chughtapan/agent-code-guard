import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import {
  getStaticMemberExpression,
  getStaticStringKey,
  resolveStringLiteralValue,
} from "../utils/ast-refinement/index.js";

const CONCURRENCY_METHODS = new Set(["all", "forEach", "validateAll"]);

function hasUnboundedConcurrencyOption(
  node: TSESTree.CallExpression["arguments"][number],
): boolean {
  return (
    node.type === AST_NODE_TYPES.ObjectExpression &&
    node.properties.some((property) => {
      if (
        property.type !== AST_NODE_TYPES.Property ||
        property.kind !== "init" ||
        property.method
      ) {
        return false;
      }
      const key = getStaticStringKey(property.key, property.computed);
      if (key !== "concurrency") return false;
      return resolveStringLiteralValue(property.value) === "unbounded";
    })
  );
}

export default createRule({
  name: "no-unbounded-concurrency",
  meta: {
    type: "problem",
    docs: {
      description: "Unbounded `Promise.all` over a runtime-sized input has no concurrency budget; bound it explicitly.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#5-discipline-over-capability",
    },
    messages: {
      noUnboundedConcurrency:
        "Unbounded concurrency on `Effect.{{method}}(...)` — use a concrete concurrency bound unless the fan-out is explicitly proven safe.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const callee = getStaticMemberExpression(node.callee);
        if (
          callee === null ||
          callee.object.type !== AST_NODE_TYPES.Identifier ||
          callee.object.name !== "Effect" ||
          !CONCURRENCY_METHODS.has(callee.property.name)
        ) {
          return;
        }

        if (!node.arguments.some(hasUnboundedConcurrencyOption)) {
          return;
        }

        context.report({
          node,
          messageId: "noUnboundedConcurrency",
          data: { method: callee.property.name },
        });
      },
    };
  },
});
