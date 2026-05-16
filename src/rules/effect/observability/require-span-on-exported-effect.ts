import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { PRINCIPLE_URL } from "../../utils/principles.js";

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

interface PendingExport {
  readonly node: TSESTree.Node;
  readonly name: string;
  hasEffectGen: boolean;
  hasWithSpan: boolean;
}

export default createRule({
  name: "require-span-on-exported-effect",
  meta: {
    type: "problem",
    docs: {
      description: "Public Effect entrypoints must carry a span so the diagnostic chain survives across the boundary.",
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
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
    let pending: PendingExport | null = null;

    return {
      ExportNamedDeclaration(node) {
        const name = exportName(node);
        if (name === null) return;
        if (node.declaration === null || node.declaration === undefined) return;
        pending = { node: node.declaration, name, hasEffectGen: false, hasWithSpan: false };
      },
      "ExportNamedDeclaration MemberExpression"(node: TSESTree.MemberExpression) {
        if (pending === null) return;
        if (node.computed) return;
        if (node.property.type !== AST_NODE_TYPES.Identifier) return;
        if (node.property.name === "withSpan") {
          pending.hasWithSpan = true;
          return;
        }
        if (
          node.property.name === "gen" &&
          node.object.type === AST_NODE_TYPES.Identifier &&
          node.object.name === "Effect"
        ) {
          pending.hasEffectGen = true;
        }
      },
      "ExportNamedDeclaration:exit"() {
        if (pending === null) return;
        const facts = pending;
        pending = null;
        if (!facts.hasEffectGen) return;
        if (facts.hasWithSpan) return;
        context.report({
          node: facts.node,
          messageId: "missingSpan",
          data: { name: facts.name },
        });
      },
    };
  },
});
