import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { isTestFile } from "../../utils/is-test-file.js";
import {
  getNumericLiteralValue,
  getStaticMemberPropertyName,
  resolveStringLiteralValue,
} from "../../utils/ast-refinement/index.js";

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

function flaggedRepr(arg: TSESTree.Node, minLen: number): string | null {
  const str = resolveStringLiteralValue(arg);
  if (str !== null) return str.length >= minLen ? JSON.stringify(str) : null;
  const num = getNumericLiteralValue(arg);
  if (num === null) return null;
  return BOUNDARY_NUMBERS.has(num) ? null : String(num);
}

function assertionArgument(
  node: TSESTree.CallExpression,
): TSESTree.CallExpressionArgument | null {
  for (const readArgument of ASSERTION_ARGUMENT_READERS) {
    const argument = readArgument(node);
    if (argument !== undefined) return argument;
  }
  return null;
}

type AssertionArgumentReader = (
  node: TSESTree.CallExpression,
) => TSESTree.CallExpressionArgument | null | undefined;

const ASSERTION_ARGUMENT_READERS: readonly AssertionArgumentReader[] = [
  firstArgMatcherArgument,
  assertMemberMatcherArgument,
  topLevelAssertArgument,
];

function firstArgMatcherArgument(
  node: TSESTree.CallExpression,
): TSESTree.CallExpressionArgument | null | undefined {
  const propertyName = memberPropertyName(node.callee);
  return propertyName !== null && isFirstArgMatcherCall(node.callee, propertyName)
    ? node.arguments[0] ?? null
    : undefined;
}

function assertMemberMatcherArgument(
  node: TSESTree.CallExpression,
): TSESTree.CallExpressionArgument | null | undefined {
  const propertyName = memberPropertyName(node.callee);
  return propertyName !== null && isAssertMemberMatcherCall(node.callee, propertyName)
    ? node.arguments[1] ?? null
    : undefined;
}

function topLevelAssertArgument(
  node: TSESTree.CallExpression,
): TSESTree.CallExpressionArgument | null | undefined {
  return isTopLevelAssertCall(node.callee) ? node.arguments[1] ?? null : undefined;
}

function memberPropertyName(node: TSESTree.CallExpression["callee"]): string | null {
  return node.type === AST_NODE_TYPES.MemberExpression
    ? getStaticMemberPropertyName(node)
    : null;
}

function isFirstArgMatcherCall(
  callee: TSESTree.CallExpression["callee"],
  propertyName: string,
): boolean {
  return callee.type === AST_NODE_TYPES.MemberExpression &&
    FIRST_ARG_MATCHERS.has(propertyName);
}

function isAssertMemberMatcherCall(
  callee: TSESTree.CallExpression["callee"],
  propertyName: string,
): boolean {
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  if (!ASSERT_MEMBER_MATCHERS.has(propertyName)) return false;
  return callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === "assert";
}

function isTopLevelAssertCall(callee: TSESTree.CallExpression["callee"]): boolean {
  return callee.type === AST_NODE_TYPES.Identifier &&
    TOP_LEVEL_ASSERT_FNS.has(callee.name);
}

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

    function checkArg(arg: TSESTree.Node): void {
      const repr = flaggedRepr(arg, minLen);
      if (repr !== null) {
        context.report({ node: arg, messageId: "hardcodedLiteral", data: { literal: repr } });
      }
    }

    return {
      CallExpression(node) {
        const arg = assertionArgument(node);
        if (arg) checkArg(arg);
      },
    };
  },
});
