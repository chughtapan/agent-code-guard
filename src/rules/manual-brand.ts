import { createRule } from "../utils/create-rule.js";
import { findManualBrandMatch } from "../utils/manual-algebra-detection.js";

const VARIABLE_SURFACE_SELECTOR =
  "VariableDeclarator[init.type='ObjectExpression'], " +
  "VariableDeclarator[init.type='FunctionExpression'], " +
  "VariableDeclarator[init.type='ArrowFunctionExpression'], " +
  "VariableDeclarator[init.type='ClassExpression']";

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
      [VARIABLE_SURFACE_SELECTOR]: maybeReport,
    };
  },
});
