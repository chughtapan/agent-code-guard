import { createRule } from "../utils/create-rule.js";
import { findManualOptionMatch } from "./detection/index.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

const VARIABLE_SURFACE_SELECTOR =
  "VariableDeclarator[init.type='ObjectExpression'], " +
  "VariableDeclarator[init.type='FunctionExpression'], " +
  "VariableDeclarator[init.type='ArrowFunctionExpression'], " +
  "VariableDeclarator[init.type='ClassExpression']";

export default createRule({
  name: "manual-option",
  meta: {
    type: "problem",
    docs: {
      description: "Hand-rolled `Option`-shaped types don't compose with the rest of the algebra; use the project's `Option` so `match` works uniformly.",
      url: PRINCIPLE_URL.EXHAUSTIVENESS,
    },
    messages: {
      manualOption:
        "Manual option-like algebra {{name}} — prefer Effect.Option or an endorsed helper instead of hand-rolling reusable Some/None wrappers.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function maybeReport(node: Parameters<typeof findManualOptionMatch>[0]): void {
      const result = findManualOptionMatch(node);
      if (result === null) return;
      context.report({
        node: result.node,
        messageId: "manualOption",
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
