import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { isTestFile } from "../utils/is-test-file.js";
import {
  getNumericLiteralValue,
  getStaticMemberPropertyName,
  getStringLiteralValue,
} from "../utils/ast-refinement.js";

const FIRST_ARG_MATCHERS = new Set([
  "toBe",
  "toEqual",
  "toStrictEqual",
  "toContain",
  "toMatch",
]);

const ASSERT_MEMBER_MATCHERS = new Set(["equal", "strictEqual", "deepEqual"]);

const TOP_LEVEL_ASSERT_FNS = new Set(["assertEquals", "assertEqual"]);

// Numeric boundary values that carry no domain meaning
const BOUNDARY_NUMBERS = new Set([-1, 0, 1, 2]);

type Options = [{ allowShorterThan?: number }];
type MessageIds = "hardcodedLiteral";

export default createRule<Options, MessageIds>({
  name: "no-hardcoded-assertion-literals",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flag hardcoded string or number literals passed directly to test assertion matchers. Export as a named constant or assert a structural property instead.",
    },
    messages: {
      hardcodedLiteral:
        "Test asserts a hardcoded value. If {{literal}} is contractual, export it as a named constant or enum member and import. If not, assert a structural property instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowShorterThan: {
            type: "integer",
            description:
              "Allow string literals with fewer than this many characters. Default: 4.",
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [{ allowShorterThan: 4 }],
  create(context, [options]) {
    if (!isTestFile(context.filename)) return {};

    const minLen = options.allowShorterThan ?? 4;

    function flaggedRepr(arg: TSESTree.Node): string | null {
      const str = getStringLiteralValue(arg);
      if (str !== null) {
        return str.length >= minLen ? JSON.stringify(str) : null;
      }
      const num = getNumericLiteralValue(arg);
      if (num !== null) {
        return BOUNDARY_NUMBERS.has(num) ? null : String(num);
      }
      return null;
    }

    function checkArg(arg: TSESTree.Node): void {
      const repr = flaggedRepr(arg);
      if (repr !== null) {
        context.report({ node: arg, messageId: "hardcodedLiteral", data: { literal: repr } });
      }
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        const propertyName =
          callee.type === AST_NODE_TYPES.MemberExpression
            ? getStaticMemberPropertyName(callee)
            : null;

        if (
          callee.type === AST_NODE_TYPES.MemberExpression &&
          propertyName !== null &&
          FIRST_ARG_MATCHERS.has(propertyName)
        ) {
          const arg = node.arguments[0];
          if (arg) checkArg(arg);
          return;
        }

        if (
          callee.type === AST_NODE_TYPES.MemberExpression &&
          callee.object.type === AST_NODE_TYPES.Identifier &&
          callee.object.name === "assert" &&
          propertyName !== null &&
          ASSERT_MEMBER_MATCHERS.has(propertyName)
        ) {
          const arg = node.arguments[1];
          if (arg) checkArg(arg);
          return;
        }

        if (
          callee.type === AST_NODE_TYPES.Identifier &&
          TOP_LEVEL_ASSERT_FNS.has(callee.name)
        ) {
          const arg = node.arguments[1];
          if (arg) checkArg(arg);
        }
      },
    };
  },
});
