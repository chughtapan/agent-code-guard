import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../../utils/create-rule.js";

function isEffectForEachCall(node: TSESTree.CallExpression): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const callee = node.callee;
  if (callee.computed) return false;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (callee.object.name !== "Effect") return false;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  return callee.property.name === "forEach";
}

function objectHasConcurrencyKey(node: TSESTree.Node): boolean {
  if (node.type !== AST_NODE_TYPES.ObjectExpression) return false;
  return node.properties.some((property) => {
    if (property.type !== AST_NODE_TYPES.Property) return false;
    if (property.computed) return false;
    if (property.key.type === AST_NODE_TYPES.Identifier) {
      return property.key.name === "concurrency";
    }
    if (property.key.type === AST_NODE_TYPES.Literal) {
      return property.key.value === "concurrency";
    }
    return false;
  });
}

export default createRule({
  name: "effect-foreach-requires-concurrency",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Effect.forEach calls without an explicit concurrency option. Default sequential is rarely what you want for I/O work; default unbounded is rarely what you want for anything.",
    },
    messages: {
      missingConcurrency:
        "Effect.forEach without an explicit concurrency option; pass { concurrency: <n> } (or `\"inherit\"` if you really mean it).",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (!isEffectForEachCall(node)) return;
        if (node.arguments.length < 2) return;
        const optionsArg = node.arguments[2];
        if (optionsArg === undefined) {
          context.report({ node, messageId: "missingConcurrency" });
          return;
        }
        if (optionsArg.type === AST_NODE_TYPES.SpreadElement) return;
        if (objectHasConcurrencyKey(optionsArg)) return;
        context.report({ node, messageId: "missingConcurrency" });
      },
    };
  },
});
