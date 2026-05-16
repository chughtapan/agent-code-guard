import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

function isEffectAcquireReleaseCall(node: TSESTree.CallExpression): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const callee = node.callee;
  if (callee.computed) return false;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (callee.object.name !== "Effect") return false;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  return callee.property.name === "acquireRelease" || callee.property.name === "acquireUseRelease";
}

function mentionsScopeFrame(node: TSESTree.Node): boolean {
  if (
    node.type === AST_NODE_TYPES.MemberExpression &&
    !node.computed &&
    node.property.type === AST_NODE_TYPES.Identifier &&
    node.property.name === "scoped"
  ) {
    return true;
  }
  if (
    node.type === AST_NODE_TYPES.Identifier &&
    (node.name === "scoped" || node.name === "scopedDiscard")
  ) {
    return true;
  }
  return false;
}

export default createRule({
  name: "acquire-release-requires-scope",
  meta: {
    type: "problem",
    docs: {
      description: "`Effect.acquireRelease` outside a `Scope` leaks the resource silently; the finalizer needs a scope to attach to or it never runs.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#3-errors-are-typed-not-thrown--tagged-errors-or-typed-results-no-raw-throws-no-silent-catches",
    },
    messages: {
      acquireWithoutScope:
        "Effect.{{method}} with no Effect.scoped / Layer.scoped reference in this file; the acquired resource has no enclosing scope to release it.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    let foundScopeFrame = false;
    const acquireCalls: { node: TSESTree.CallExpression; method: string }[] = [];
    return {
      MemberExpression(node) {
        if (mentionsScopeFrame(node)) foundScopeFrame = true;
      },
      Identifier(node) {
        if (mentionsScopeFrame(node)) foundScopeFrame = true;
      },
      CallExpression(node) {
        if (!isEffectAcquireReleaseCall(node)) return;
        const callee = node.callee;
        if (callee.type !== AST_NODE_TYPES.MemberExpression) return;
        if (callee.property.type !== AST_NODE_TYPES.Identifier) return;
        acquireCalls.push({ node, method: callee.property.name });
      },
      "Program:exit"() {
        if (foundScopeFrame) return;
        for (const { node, method } of acquireCalls) {
          context.report({
            node,
            messageId: "acquireWithoutScope",
            data: { method },
          });
        }
      },
    };
  },
});
