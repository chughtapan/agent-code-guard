import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

const PROMISE_STATICS = new Set(["all", "allSettled", "race", "any"]);

function importsEffect(source: string): boolean {
  return source === "effect" || source.startsWith("@effect/");
}

function promiseStaticName(node: TSESTree.CallExpression): string | null {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  const callee = node.callee;
  if (callee.computed) return null;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return null;
  if (callee.object.name !== "Promise") return null;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return null;
  if (!PROMISE_STATICS.has(callee.property.name)) return null;
  return callee.property.name;
}

export default createRule({
  name: "no-promise-all-in-effect",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Promise.all/allSettled/race/any in files importing Effect. Use Effect.all/forEach with explicit concurrency.",
    },
    messages: {
      promiseStaticInEffect:
        "Promise.{{name}} in an Effect file; use Effect.all or Effect.forEach with explicit concurrency",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    let foundEffectImport = false;
    const promiseCalls: { node: TSESTree.CallExpression; name: string }[] = [];
    return {
      ImportDeclaration(node) {
        if (typeof node.source.value === "string" && importsEffect(node.source.value)) {
          foundEffectImport = true;
        }
      },
      CallExpression(node) {
        const name = promiseStaticName(node);
        if (name === null) return;
        promiseCalls.push({ node, name });
      },
      "Program:exit"() {
        if (!foundEffectImport) return;
        for (const { node, name } of promiseCalls) {
          context.report({
            node,
            messageId: "promiseStaticInEffect",
            data: { name },
          });
        }
      },
    };
  },
});
