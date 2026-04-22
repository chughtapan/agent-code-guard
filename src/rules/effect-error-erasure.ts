import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const GENERIC_ERROR_CTORS = new Set(["Error", "TypeError", "RangeError"]);

function isGenericErrorCtor(
  node: TSESTree.Node | null,
): node is TSESTree.NewExpression {
  return (
    node?.type === AST_NODE_TYPES.NewExpression &&
    node.callee.type === AST_NODE_TYPES.Identifier &&
    GENERIC_ERROR_CTORS.has(node.callee.name)
  );
}

function isEffectCall(node: TSESTree.CallExpression, name: string): boolean {
  const callee = node.callee;
  return (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    !callee.computed &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === "Effect" &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    callee.property.name === name
  );
}

function functionReturnsGenericError(
  node: TSESTree.Expression,
): boolean {
  if (
    node.type !== AST_NODE_TYPES.ArrowFunctionExpression &&
    node.type !== AST_NODE_TYPES.FunctionExpression
  ) {
    return false;
  }

  if (node.body.type !== AST_NODE_TYPES.BlockStatement) {
    return isGenericErrorCtor(node.body);
  }

  return node.body.body.some(
    (statement) =>
      statement.type === AST_NODE_TYPES.ReturnStatement &&
      isGenericErrorCtor(statement.argument),
  );
}

export default createRule({
  name: "effect-error-erasure",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag generic `Error` values pushed into the Effect error channel. Use a tagged domain error instead.",
    },
    messages: {
      effectErrorErasure:
        "Generic Error in the Effect error channel — use a tagged domain error instead of Error/TypeError/RangeError.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const firstArgument = node.arguments[0] ?? null;
        if (
          isEffectCall(node, "fail") &&
          isGenericErrorCtor(firstArgument)
        ) {
          context.report({ node, messageId: "effectErrorErasure" });
          return;
        }

        if (!isEffectCall(node, "mapError")) return;
        const mapper = node.arguments[0];
        if (mapper === undefined || mapper.type === AST_NODE_TYPES.SpreadElement) {
          return;
        }
        if (!functionReturnsGenericError(mapper)) {
          return;
        }
        context.report({ node, messageId: "effectErrorErasure" });
      },
    };
  },
});
