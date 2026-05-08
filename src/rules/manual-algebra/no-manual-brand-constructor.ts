import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { findManualBrandConstructorMatch } from "../../utils/manual-algebra-brand-helper.js";

const VARIABLE_FUNCTION_SELECTOR =
  "VariableDeclarator[init.type='FunctionExpression'], " +
  "VariableDeclarator[init.type='ArrowFunctionExpression']";

export default createRule({
  name: "no-manual-brand-constructor",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag constructor functions that create branded values by casting. Use Brand.nominal or schema decoding at the boundary instead.",
    },
    messages: {
      manualBrandConstructor:
        "Manual brand constructor {{name}} casts into {{target}}. Use Brand.nominal, Schema.brand, or a boundary parser instead of a reusable cast helper.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function maybeReport(node: TSESTree.Node): void {
      const match = findManualBrandConstructorMatch(node);
      if (match === null) return;
      context.report({
        node: match.node,
        messageId: "manualBrandConstructor",
        data: { name: match.displayName, target: match.targetType },
      });
    }

    return {
      FunctionDeclaration: maybeReport,
      [VARIABLE_FUNCTION_SELECTOR]: maybeReport,
    };
  },
});
