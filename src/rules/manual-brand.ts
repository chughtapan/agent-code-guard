import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { findManualBrandMatch } from "../utils/manual-algebra-detection.js";

export default createRule({
  name: "manual-brand",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flag hand-rolled nominal brand surfaces. Prefer Effect Brand.nominal or an endorsed helper instead.",
    },
    messages: {
      manualBrand:
        "Manual brand surface {{name}} — prefer Effect Brand.nominal or an endorsed helper instead of hand-rolling branded aliases.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function maybeReport(node: Parameters<typeof findManualBrandMatch>[0]): void {
      const result = findManualBrandMatch(node);
      if (result === null) return;
      context.report({
        node: result.node,
        messageId: "manualBrand",
        data: { name: result.displayName },
      });
    }

    return {
      TSTypeAliasDeclaration: maybeReport,
      TSInterfaceDeclaration: maybeReport,
      ClassDeclaration: maybeReport,
      FunctionDeclaration: maybeReport,
      VariableDeclarator(node) {
        if (
          node.init?.type === AST_NODE_TYPES.ObjectExpression ||
          node.init?.type === AST_NODE_TYPES.FunctionExpression ||
          node.init?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
          node.init?.type === AST_NODE_TYPES.ClassExpression
        ) {
          maybeReport(node);
        }
      },
    };
  },
});
