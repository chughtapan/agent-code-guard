/**
 * @file Rejects `vi.mock`, `vi.hoisted`, and `vi.spyOn` calls so dependencies
 * stay real instead of being replaced with test doubles.
 */

import { getStaticMemberExpression } from "../utils/ast-refinement/index.js";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

const MOCK_METHODS = new Set(["mock", "hoisted", "spyOn"]);

/**
 * Enforces the `no-vitest-mocks` Agent Code Guard rule.
 */
export const noVitestMocks = createRule({
  name: "no-vitest-mocks",
  meta: {
    type: "problem",
    docs: {
      description:
        "An integration test that mocks the boundary asserts your code works against your mock, not the real thing.",
      url: PRINCIPLE_URL.VALIDATE_AT_BOUNDARY,
    },
    messages: {
      vitestMock: "vi.{{method}}() disallowed here — test against real dependencies in this scope",
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
        if (callee === null) {
          return;
        }
        if (callee.object.type !== "Identifier" || callee.object.name !== "vi") {
          return;
        }
        const method = callee.property.name;
        if (!MOCK_METHODS.has(method)) {
          return;
        }
        context.report({
          node,
          messageId: "vitestMock",
          data: { method },
        });
      },
    };
  },
});
