import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { findManualOptionMatch } from "../utils/manual-algebra-detection.js";

export default createRule({
  name: "manual-option",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag hand-rolled Option/Maybe-like algebra surfaces. Prefer Effect.Option or an endorsed helper instead.",
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
