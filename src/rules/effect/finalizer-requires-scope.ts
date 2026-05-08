import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

function isScopeFinalizerCall(node: TSESTree.CallExpression): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const callee = node.callee;
  if (callee.computed) return false;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (callee.object.name !== "Scope") return false;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  return callee.property.name === "addFinalizer";
}

function mentionsScopeFrame(node: TSESTree.Node): boolean {
  if (
    node.type === AST_NODE_TYPES.MemberExpression &&
    !node.computed &&
    node.property.type === AST_NODE_TYPES.Identifier &&
    (node.property.name === "scoped" || node.property.name === "scopedDiscard")
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
  name: "finalizer-requires-scope",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Scope.addFinalizer calls in files that never reference scoped frames. Without a Scope context the finalizer never runs.",
    },
    messages: {
      finalizerWithoutScope:
        "Scope.addFinalizer in a file with no scoped frame reference; without an enclosing Effect.scoped / Layer.scoped the finalizer never runs.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    let foundScopeFrame = false;
    const finalizerCalls: TSESTree.CallExpression[] = [];
    return {
      MemberExpression(node) {
        if (mentionsScopeFrame(node)) foundScopeFrame = true;
      },
      Identifier(node) {
        if (mentionsScopeFrame(node)) foundScopeFrame = true;
      },
      CallExpression(node) {
        if (isScopeFinalizerCall(node)) finalizerCalls.push(node);
      },
      "Program:exit"() {
        if (foundScopeFrame) return;
        for (const call of finalizerCalls) {
          context.report({ node: call, messageId: "finalizerWithoutScope" });
        }
      },
    };
  },
});
