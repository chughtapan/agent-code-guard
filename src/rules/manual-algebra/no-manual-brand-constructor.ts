import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { findManualBrandConstructorMatch } from "./detection/brand-helper.js";

const VARIABLE_FUNCTION_SELECTOR =
  "VariableDeclarator[init.type='FunctionExpression'], " +
  "VariableDeclarator[init.type='ArrowFunctionExpression']";

export default createRule({
  name: "no-manual-brand-constructor",
  meta: {
    type: "problem",
    docs: {
      description: "Manually constructing a branded value bypasses the validation that earned the brand; use the smart constructor.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#1-types-beat-tests--move-constraints-into-the-type-system",
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
