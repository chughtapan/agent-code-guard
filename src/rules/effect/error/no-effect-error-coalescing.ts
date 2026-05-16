import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { isNamedMemberCall } from "../../utils/ast-refinement/index.js";
import { PRINCIPLE_URL } from "../../utils/principles.js";

const ERROR_COALESCING_METHODS = new Set(["catchAll", "catchAllCause", "mapError"]);

export default createRule({
  name: "no-effect-error-coalescing",
  meta: {
    type: "problem",
    docs: {
      description: "Coalescing distinct effect errors into one tag erases the diagnostic; downstream needs the tag set the upstream produced.",
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
    },
    messages: {
      effectErrorCoalescing:
        "Do not coalesce Effect error variants into {{name}}. Preserve the typed error union or handle each tag explicitly.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const method = effectMethodName(node);
        if (method === null || !ERROR_COALESCING_METHODS.has(method)) return;
        const mapper = node.arguments[0];
        if (!mapper || mapper.type === AST_NODE_TYPES.SpreadElement) return;
        const errorName = returnedWrapperErrorName(mapper);
        if (errorName === null) return;
        context.report({
          node,
          messageId: "effectErrorCoalescing",
          data: { name: errorName },
        });
      },
    };
  },
});

function effectMethodName(node: TSESTree.CallExpression): string | null {
  for (const method of ERROR_COALESCING_METHODS) {
    if (isNamedMemberCall(node, "Effect", method)) return method;
  }
  return null;
}

function returnedWrapperErrorName(node: TSESTree.Expression): string | null {
  if (!isFunctionExpression(node)) return null;
  if (node.body.type !== AST_NODE_TYPES.BlockStatement) {
    return wrapperErrorName(node.body);
  }
  for (const statement of node.body.body) {
    if (statement.type !== AST_NODE_TYPES.ReturnStatement || !statement.argument) continue;
    const name = wrapperErrorName(statement.argument);
    if (name !== null) return name;
  }
  return null;
}

function wrapperErrorName(node: TSESTree.Expression): string | null {
  if (node.type === AST_NODE_TYPES.NewExpression) return newExpressionName(node);
  if (!isEffectFailExpression(node)) return null;
  const firstArgument = node.arguments[0];
  return firstArgument?.type === AST_NODE_TYPES.NewExpression
    ? newExpressionName(firstArgument)
    : null;
}

function isEffectFailExpression(node: TSESTree.Expression): node is TSESTree.CallExpression {
  return node.type === AST_NODE_TYPES.CallExpression &&
    isNamedMemberCall(node, "Effect", "fail");
}

function newExpressionName(node: TSESTree.NewExpression): string | null {
  return node.callee.type === AST_NODE_TYPES.Identifier ? node.callee.name : null;
}

function isFunctionExpression(
  node: TSESTree.Expression,
): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
  return node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionExpression;
}
