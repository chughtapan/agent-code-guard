import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../../utils/create-rule.js";

const FORK_METHODS = new Set(["fork"]);

function effectForkCall(node: TSESTree.CallExpression): string | null {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  const callee = node.callee;
  if (callee.computed) return null;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return null;
  if (callee.object.name !== "Effect") return null;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return null;
  if (!FORK_METHODS.has(callee.property.name)) return null;
  return callee.property.name;
}

function isResultDiscarded(node: TSESTree.CallExpression): boolean {
  const parent = node.parent;
  if (parent === undefined) return false;
  if (parent.type === AST_NODE_TYPES.ExpressionStatement) return true;
  if (parent.type === AST_NODE_TYPES.YieldExpression) {
    const grand = parent.parent;
    return grand !== undefined && grand.type === AST_NODE_TYPES.ExpressionStatement;
  }
  if (parent.type === AST_NODE_TYPES.AwaitExpression) {
    const grand = parent.parent;
    return grand !== undefined && grand.type === AST_NODE_TYPES.ExpressionStatement;
  }
  return false;
}

export default createRule({
  name: "fork-requires-lifecycle",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Effect.fork(...) whose return value is discarded. Capture the Fiber and await/interrupt it, or use Effect.forkScoped / Effect.forkDaemon.",
    },
    messages: {
      forkResultDiscarded:
        "Effect.{{method}} result discarded; capture the Fiber to await/interrupt it, or use Effect.forkScoped (auto-interrupt on scope close) / Effect.forkDaemon (long-lived).",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const method = effectForkCall(node);
        if (method === null) return;
        if (!isResultDiscarded(node)) return;
        context.report({
          node,
          messageId: "forkResultDiscarded",
          data: { method },
        });
      },
    };
  },
});
