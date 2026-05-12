import { createRule } from "../utils/create-rule.js";
import { findManualBrandMatch } from "./detection/index.js";

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
        "Flag hand-rolled brand surfaces. Prefer a refined brand (Schema.brand on top of a refinement predicate) so the type is a witness of a checked invariant, not just a nominal label.",
    },
    messages: {
      manualBrand:
        "Manual brand surface {{name}} — prefer a refined brand: Schema.<Primitive>.pipe(Schema.refine(predicate)).pipe(Schema.brand(\"{{name}}\")). Fall back to Brand.nominal only for opaque IDs with no domain predicate.",
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
