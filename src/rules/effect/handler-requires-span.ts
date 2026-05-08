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

function isAstNode(value: unknown): value is TSESTree.Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

function nodeContains(
  root: TSESTree.Node,
  predicate: (node: TSESTree.Node) => boolean,
): boolean {
  if (predicate(root)) return true;
  for (const key of Object.keys(root) as ReadonlyArray<keyof TSESTree.Node>) {
    if (key === "parent") continue;
    const value = root[key];
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const child of value) {
        if (isAstNode(child) && nodeContains(child, predicate)) return true;
      }
    } else if (isAstNode(value) && nodeContains(value, predicate)) return true;
  }
  return false;
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

function findEnclosingPipeOrCall(node: TSESTree.Node): TSESTree.Node {
  let current: TSESTree.Node = node;
  while (current.parent !== undefined) {
    const parent = current.parent;
    if (
      parent.type === AST_NODE_TYPES.CallExpression &&
      parent.callee.type === AST_NODE_TYPES.MemberExpression &&
      !parent.callee.computed &&
      parent.callee.property.type === AST_NODE_TYPES.Identifier &&
      parent.callee.property.name === "pipe"
    ) {
      current = parent;
      continue;
    }
    if (
      parent.type === AST_NODE_TYPES.MemberExpression &&
      !parent.computed &&
      parent.property.type === AST_NODE_TYPES.Identifier &&
      parent.property.name === "pipe"
    ) {
      current = parent;
      continue;
    }
    break;
  }
  return current;
}

export default createRule({
  name: "handler-requires-span",
  meta: {
    type: "problem",
    docs: {
      description:
        "In handler/route files, flag Effect.gen bodies that don't reference Effect.withSpan. Handlers are trace boundaries.",
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
    return {
      CallExpression(node) {
        if (!isEffectGenCall(node)) return;
        const scope = findEnclosingPipeOrCall(node);
        if (nodeContains(scope, mentionsWithSpan)) return;
        context.report({ node, messageId: "handlerMissingSpan" });
      },
    };
  },
});
