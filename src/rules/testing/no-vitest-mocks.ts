import { createRule } from "../utils/create-rule.js";
import { getStaticMemberExpression } from "../utils/ast-refinement/index.js";

const MOCK_METHODS = new Set(["mock", "hoisted", "spyOn"]);

export default createRule({
  name: "no-vitest-mocks",
  meta: {
    type: "problem",
    docs: {
      description: "An integration test that mocks the boundary asserts your code works against your mock, not the real thing.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#2-validate-at-every-boundary--schemas-where-data-enters-types-inside",
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
        const callee = getStaticMemberExpression(node.callee);
        if (callee === null) return;
        if (
          callee.object.type !== "Identifier" ||
          callee.object.name !== "vi"
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
