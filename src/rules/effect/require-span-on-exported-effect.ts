import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

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

function isAstNode(value: unknown): value is TSESTree.Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

function isEffectGenCall(node: TSESTree.Node): boolean {
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

function exportContainsEffectGen(node: TSESTree.Node): boolean {
  return nodeContains(node, isEffectGenCall);
}

function exportContainsWithSpan(node: TSESTree.Node): boolean {
  return nodeContains(node, mentionsWithSpan);
}

function exportName(node: TSESTree.ExportNamedDeclaration): string | null {
  const declaration = node.declaration;
  if (declaration === null || declaration === undefined) return null;
  if (declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    return declaration.id?.name ?? null;
  }
  if (declaration.type === AST_NODE_TYPES.VariableDeclaration) {
    const first = declaration.declarations[0];
    if (first?.id.type === AST_NODE_TYPES.Identifier) return first.id.name;
  }
  return null;
}

export default createRule({
  name: "require-span-on-exported-effect",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag exported Effect.gen-bearing values that never call Effect.withSpan in their definition. Trace boundaries belong on exported Effect surfaces.",
    },
    messages: {
      missingSpan:
        "Exported Effect `{{name}}` defines an Effect.gen body without Effect.withSpan; add `Effect.withSpan(\"{{name}}\")` so the trace shows up under its name.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const name = exportName(node);
        if (name === null) return;
        if (node.declaration === null || node.declaration === undefined) return;
        if (!exportContainsEffectGen(node.declaration)) return;
        if (exportContainsWithSpan(node.declaration)) return;
        context.report({
          node: node.declaration,
          messageId: "missingSpan",
          data: { name },
        });
      },
    };
  },
});
