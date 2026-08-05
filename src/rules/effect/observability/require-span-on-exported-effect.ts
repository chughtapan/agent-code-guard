/**
 * @file Requires exported Effect-producing functions to be wrapped in spans.
 */

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { PRINCIPLE_URL } from "../../utils/principles.js";

function exportName(node: TSESTree.ExportNamedDeclaration): string | null {
  const declaration = node.declaration;
  if (declaration === null || declaration === undefined) {
    return null;
  }
  if (declaration.type === AST_NODE_TYPES.FunctionDeclaration) {
    return functionExportName(declaration);
  }
  if (declaration.type === AST_NODE_TYPES.VariableDeclaration) {
    return variableExportName(declaration);
  }
  return null;
}

function functionExportName(declaration: TSESTree.FunctionDeclaration): string | null {
  return declaration.id?.name ?? null;
}

function variableExportName(declaration: TSESTree.VariableDeclaration): string | null {
  const first = declaration.declarations[0];
  if (first === undefined) {
    return null;
  }
  if (first.id.type !== AST_NODE_TYPES.Identifier) {
    return null;
  }
  return first.id.name;
}

interface PendingExport {
  readonly node: TSESTree.Node;
  readonly name: string;
  hasEffectGen: boolean;
  hasWithSpan: boolean;
}

interface ExportScan {
  pending: PendingExport | null;
}

function inspectExportMember(scan: ExportScan, node: TSESTree.MemberExpression): void {
  if (scan.pending === null || node.computed) {
    return;
  }
  if (node.property.type !== AST_NODE_TYPES.Identifier) {
    return;
  }
  if (node.property.name === "withSpan") {
    scan.pending.hasWithSpan = true;
    return;
  }
  if (
    node.property.name === "gen" &&
    node.object.type === AST_NODE_TYPES.Identifier &&
    node.object.name === "Effect"
  ) {
    scan.pending.hasEffectGen = true;
  }
}

function finishExport(context: TSESLint.RuleContext<"missingSpan", []>, scan: ExportScan): void {
  const facts = scan.pending;
  scan.pending = null;
  if (facts === null || !facts.hasEffectGen || facts.hasWithSpan) {
    return;
  }
  context.report({
    node: facts.node,
    messageId: "missingSpan",
    data: { name: facts.name },
  });
}

function spanListeners(
  context: TSESLint.RuleContext<"missingSpan", []>,
  scan: ExportScan,
): TSESLint.RuleListener {
  return {
    ExportNamedDeclaration(node) {
      const name = exportName(node);
      if (name === null || node.declaration == null) {
        return;
      }
      scan.pending = { node: node.declaration, name, hasEffectGen: false, hasWithSpan: false };
    },
    "ExportNamedDeclaration MemberExpression"(node: TSESTree.MemberExpression) {
      inspectExportMember(scan, node);
    },
    "ExportNamedDeclaration:exit"() {
      finishExport(context, scan);
    },
  };
}

/**
 * Enforces the `require-span-on-exported-effect` Agent Code Guard rule.
 */
export const requireSpanOnExportedEffect = createRule({
  name: "require-span-on-exported-effect",
  meta: {
    type: "problem",
    docs: {
      description:
        "Public Effect entrypoints must carry a span so the diagnostic chain survives across the boundary.",
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
    },
    messages: {
      missingSpan:
        'Exported Effect `{{name}}` defines an Effect.gen body without Effect.withSpan; add `Effect.withSpan("{{name}}")` so the trace shows up under its name.',
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return spanListeners(context, { pending: null });
  },
});
