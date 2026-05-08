import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

function functionExportName(
  declaration: TSESTree.FunctionDeclaration,
): string | null {
  return declaration.id?.name ?? null;
}

function variableExportName(
  declaration: TSESTree.VariableDeclaration,
): string | null {
  const first = declaration.declarations[0];
  if (first === undefined) return null;
  if (first.id.type !== AST_NODE_TYPES.Identifier) return null;
  return first.id.name;
}

function exportName(node: TSESTree.ExportNamedDeclaration): string | null {
  const declaration = node.declaration;
  if (declaration === null || declaration === undefined) return null;
  if (declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    return functionExportName(declaration);
  }
  if (declaration.type === AST_NODE_TYPES.VariableDeclaration) {
    return variableExportName(declaration);
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
    const sourceCode = context.sourceCode;
    return {
      ExportNamedDeclaration(node) {
        const name = exportName(node);
        if (name === null) return;
        if (node.declaration === null || node.declaration === undefined) return;
        const text = sourceCode.getText(node.declaration);
        if (!text.includes("Effect.gen")) return;
        if (text.includes("withSpan")) return;
        context.report({
          node: node.declaration,
          messageId: "missingSpan",
          data: { name },
        });
      },
    };
  },
});
