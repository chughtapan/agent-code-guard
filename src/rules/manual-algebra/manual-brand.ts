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
      description: "A hand-rolled brand without a smart constructor enforces nothing; use the project's `Brand` helper so the constructor is the only path in.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#1-types-beat-tests--move-constraints-into-the-type-system",
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
