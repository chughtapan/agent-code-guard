import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const ERROR_CTORS = new Set(["Error", "TypeError", "RangeError"]);

const TEST_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /[\\/]tests?[\\/]/,
];

function isTestFile(filename: string): boolean {
  return TEST_FILE_PATTERNS.some((p) => p.test(filename));
}

function enclosingFunctionName(
  node: TSESTree.Node,
): string | null {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (current.type === AST_NODE_TYPES.FunctionDeclaration) {
      return current.id ? current.id.name : null;
    }
    if (
      current.type === AST_NODE_TYPES.FunctionExpression ||
      current.type === AST_NODE_TYPES.ArrowFunctionExpression
    ) {
      const parent = current.parent;
      if (parent?.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier) {
        return parent.id.name;
      }
      if (parent?.type === AST_NODE_TYPES.Property && !parent.computed) {
        if (parent.key.type === AST_NODE_TYPES.Identifier) return parent.key.name;
        if (parent.key.type === AST_NODE_TYPES.Literal && typeof parent.key.value === "string") return parent.key.value;
      }
      return null;
    }
    current = current.parent;
  }
  return null;
}

export default createRule({
  name: "no-raw-throw-new-error",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag `throw new Error(...)` (and TypeError/RangeError) in non-test code. Return a tagged error or Effect.fail instead.",
    },
    messages: {
      rawThrow:
        "Return a tagged error or Effect.fail; raw `throw new {{ctor}}` erases the error channel and forces callers to catch-all. See docs/rules/no-raw-throw-new-error.md.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    if (isTestFile(context.filename)) return {};
    return {
      ThrowStatement(node) {
        const arg = node.argument;
        if (arg.type !== AST_NODE_TYPES.NewExpression) return;
        if (arg.callee.type !== AST_NODE_TYPES.Identifier) return;
        const ctor = arg.callee.name;
        if (!ERROR_CTORS.has(ctor)) return;
        const fnName = enclosingFunctionName(node);
        if (fnName && fnName.startsWith("absurd")) return;
        context.report({
          node,
          messageId: "rawThrow",
          data: { ctor },
        });
      },
    };
  },
});
