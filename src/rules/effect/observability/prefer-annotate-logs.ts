import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../../utils/create-rule.js";

const LOG_METHODS = new Set([
  "log",
  "logDebug",
  "logInfo",
  "logWarning",
  "logError",
  "logFatal",
  "logTrace",
]);

function effectLogCall(node: TSESTree.CallExpression): string | null {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  const callee = node.callee;
  if (callee.computed) return null;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return null;
  if (callee.object.name !== "Effect") return null;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return null;
  if (!LOG_METHODS.has(callee.property.name)) return null;
  return callee.property.name;
}

function isObjectLiteralArgument(arg: TSESTree.CallExpressionArgument): boolean {
  return arg.type === AST_NODE_TYPES.ObjectExpression;
}

export default createRule({
  name: "prefer-annotate-logs",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Effect.log* calls whose second argument is an object literal. Use Effect.annotateLogs to attach structured context once, instead of re-passing it at each call.",
    },
    messages: {
      preferAnnotateLogs:
        "Effect.{{method}} with an inline context object; use Effect.annotateLogs({...}) once on the surrounding Effect so every log inside inherits the annotations.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const method = effectLogCall(node);
        if (method === null) return;
        if (node.arguments.length < 2) return;
        const second = node.arguments[1];
        if (second === undefined) return;
        if (!isObjectLiteralArgument(second)) return;
        context.report({
          node,
          messageId: "preferAnnotateLogs",
          data: { method },
        });
      },
    };
  },
});
