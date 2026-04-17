import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

export default createRule({
  name: "bare-catch",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag `catch {}` blocks that silently swallow errors or bind them to `_`-prefixed names.",
    },
    messages: {
      bareCatch: "Silently swallowed error — always bind and log it",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CatchClause(node) {
        const param = node.param;
        if (param === null || param === undefined) {
          context.report({ node, messageId: "bareCatch" });
          return;
        }
        if (
          param.type === AST_NODE_TYPES.Identifier &&
          param.name.startsWith("_")
        ) {
          context.report({ node, messageId: "bareCatch" });
        }
      },
    };
  },
});
