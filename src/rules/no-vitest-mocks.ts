import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const MOCK_METHODS = new Set(["mock", "hoisted", "spyOn"]);

export default createRule({
  name: "no-vitest-mocks",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag `vi.mock` / `vi.hoisted` / `vi.spyOn` calls. Scope this rule to your integration-test glob via flat-config `files:` to enforce real dependencies there.",
    },
    messages: {
      vitestMock:
        "vi.{{method}}() disallowed here — test against real dependencies in this scope",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== AST_NODE_TYPES.MemberExpression) return;
        if (
          callee.object.type !== AST_NODE_TYPES.Identifier ||
          callee.object.name !== "vi"
        ) {
          return;
        }
        if (
          callee.property.type !== AST_NODE_TYPES.Identifier ||
          callee.computed
        ) {
          return;
        }
        const method = callee.property.name;
        if (!MOCK_METHODS.has(method)) return;
        context.report({
          node,
          messageId: "vitestMock",
          data: { method },
        });
      },
    };
  },
});
