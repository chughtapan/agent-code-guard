import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

function isMemberCallToEffectMethod(
  node: TSESTree.CallExpression,
  method: string,
): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const callee = node.callee;
  if (callee.computed) return false;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (callee.object.name !== "Effect") return false;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  return callee.property.name === method;
}

function mentionsWithSpan(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.Identifier && node.name === "withSpan") return true;
  if (
    node.type === AST_NODE_TYPES.MemberExpression &&
    !node.computed &&
    node.property.type === AST_NODE_TYPES.Identifier &&
    node.property.name === "withSpan"
  ) {
    return true;
  }
  return false;
}

export default createRule({
  name: "annotate-without-span",
  meta: {
    type: "problem",
    docs: {
      description: "`Effect.annotateCurrentSpan` outside a span has no carrier; annotations attach to the span scope or vanish.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#3-errors-are-typed-not-thrown--tagged-errors-or-typed-results-no-raw-throws-no-silent-catches",
    },
    messages: {
      annotateWithoutSpan:
        "Effect.annotateCurrentSpan with no withSpan reference anywhere in this file; without an enclosing span the annotation has nothing to attach to.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    let foundWithSpan = false;
    const annotateCalls: TSESTree.CallExpression[] = [];
    return {
      Identifier(node) {
        if (mentionsWithSpan(node)) foundWithSpan = true;
      },
      MemberExpression(node) {
        if (mentionsWithSpan(node)) foundWithSpan = true;
      },
      CallExpression(node) {
        if (isMemberCallToEffectMethod(node, "annotateCurrentSpan")) {
          annotateCalls.push(node);
        }
      },
      "Program:exit"() {
        if (foundWithSpan) return;
        for (const call of annotateCalls) {
          context.report({ node: call, messageId: "annotateWithoutSpan" });
        }
      },
    };
  },
});
