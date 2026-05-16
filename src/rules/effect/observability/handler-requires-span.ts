import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

const HANDLER_FILE_PATTERNS = [
  /(^|[\\/])handlers?[\\/]/,
  /(^|[\\/])routes?[\\/]/,
  /[-.]handler\.[cm]?[jt]sx?$/,
  /[-.]route\.[cm]?[jt]sx?$/,
];

function isHandlerFile(filename: string): boolean {
  return HANDLER_FILE_PATTERNS.some((pattern) => pattern.test(filename));
}

function isEffectGenCall(node: TSESTree.Node): node is TSESTree.CallExpression {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  if (callee.computed) return false;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (callee.object.name !== "Effect") return false;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  return callee.property.name === "gen";
}

function topOfPipeChain(node: TSESTree.Node): TSESTree.Node {
  let current: TSESTree.Node = node;
  while (
    current.parent !== null &&
    current.parent !== undefined &&
    isPipeMemberContext(current.parent)
  ) {
    current = current.parent;
  }
  return current;
}

function isPipeMember(node: TSESTree.MemberExpression): boolean {
  if (node.computed) return false;
  if (node.property.type !== AST_NODE_TYPES.Identifier) return false;
  return node.property.name === "pipe";
}

function isPipeCall(node: TSESTree.CallExpression): boolean {
  return (
    node.callee.type === AST_NODE_TYPES.MemberExpression &&
    isPipeMember(node.callee)
  );
}

function isPipeMemberContext(parent: TSESTree.Node): boolean {
  if (parent.type === AST_NODE_TYPES.MemberExpression) return isPipeMember(parent);
  if (parent.type === AST_NODE_TYPES.CallExpression) return isPipeCall(parent);
  return false;
}

export default createRule({
  name: "handler-requires-span",
  meta: {
    type: "problem",
    docs: {
      description: "Exported Effect handlers must wrap themselves in `Effect.withSpan`; without it the diagnostic chain breaks at the API boundary.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#3-errors-are-typed-not-thrown--tagged-errors-or-typed-results-no-raw-throws-no-silent-catches",
    },
    messages: {
      handlerMissingSpan:
        "Effect.gen body in a handler file with no Effect.withSpan reference; add a withSpan so the trace shows up under a named handler boundary.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    if (!isHandlerFile(context.filename)) return {};
    const sourceCode = context.sourceCode;
    return {
      CallExpression(node) {
        if (!isEffectGenCall(node)) return;
        const scope = topOfPipeChain(node);
        const text = sourceCode.getText(scope);
        if (text.includes("withSpan")) return;
        context.report({ node, messageId: "handlerMissingSpan" });
      },
    };
  },
});
