import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

export default createRule({
  name: "bare-catch",
  meta: {
    type: "problem",
    docs: {
      description: "A silent catch hides both the error AND the branch; exhaustiveness cannot apply.",
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
    },
    messages: {
      bareCatch: "Silently swallowed error — always bind and log it",
      bindError: "Bind the caught error to `err` (remove the underscore / add the param)",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: true,
  },
  defaultOptions: [],
  create(context) {
    return {
      CatchClause(node) {
        const param = node.param;
        if (param === null) {
          const catchKeywordEnd = node.range[0] + "catch".length;
          context.report({
            node,
            messageId: "bareCatch",
            suggest: [
              {
                messageId: "bindError",
                fix: (fixer) =>
                  fixer.insertTextAfterRange(
                    [node.range[0], catchKeywordEnd],
                    " (err)",
                  ),
              },
            ],
          });
          return;
        }
        if (
          param.type === AST_NODE_TYPES.Identifier &&
          param.name.startsWith("_")
        ) {
          context.report({
            node,
            messageId: "bareCatch",
            suggest: [
              {
                messageId: "bindError",
                fix: (fixer) => fixer.replaceText(param, "err"),
              },
            ],
          });
        }
      },
    };
  },
});
