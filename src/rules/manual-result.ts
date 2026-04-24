import { createRule } from "../utils/create-rule.js";
import { findManualResultMatch } from "../utils/manual-algebra-detection.js";

const VARIABLE_SURFACE_SELECTOR =
  "VariableDeclarator[init.type='ObjectExpression'], " +
  "VariableDeclarator[init.type='FunctionExpression'], " +
  "VariableDeclarator[init.type='ArrowFunctionExpression'], " +
  "VariableDeclarator[init.type='ClassExpression']";

export default createRule({
  name: "manual-result",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag hand-rolled Result/Either-like algebra surfaces. Prefer Effect.Either/Effect or an endorsed helper instead.",
    },
    messages: {
      manualResult:
        "Manual result-like algebra {{name}} — prefer Effect.Either/Effect or an endorsed helper instead of hand-rolling reusable success/failure wrappers.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function maybeReport(node: Parameters<typeof findManualResultMatch>[0]): void {
      const result = findManualResultMatch(node);
      if (result === null) return;
      context.report({
        node: result.node,
        messageId: "manualResult",
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
