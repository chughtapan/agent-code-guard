import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

function isPromiseTypeReference(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.TSTypeReference &&
    node.typeName.type === AST_NODE_TYPES.Identifier &&
    node.typeName.name === "Promise"
  );
}

function isReturnTypeAnnotation(
  node: TSESTree.TSTypeReference,
): boolean {
  const annotation = node.parent;
  // Stryker disable next-line ConditionalExpression,BlockStatement -- equivalent: if annotation.type !== TSTypeAnnotation, owner falls to switch default (returns false) in all reachable TypeScript AST inputs
  if (!annotation || annotation.type !== AST_NODE_TYPES.TSTypeAnnotation) {
    return false;
  }
  const owner = annotation.parent;
  // Stryker disable next-line ConditionalExpression,BooleanLiteral -- equivalent: annotation.parent is never null in ESLint AST traversal
  if (!owner) return false;

  switch (owner.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
    case AST_NODE_TYPES.FunctionExpression:
    case AST_NODE_TYPES.ArrowFunctionExpression:
    case AST_NODE_TYPES.TSFunctionType:
    case AST_NODE_TYPES.TSMethodSignature:
    case AST_NODE_TYPES.TSDeclareFunction:
    case AST_NODE_TYPES.TSEmptyBodyFunctionExpression:
      // Stryker disable next-line ConditionalExpression -- equivalent: when owner is a function-type node, owner.returnType === annotation is a structural tautology of the @typescript-eslint AST
      return owner.returnType === annotation;
    default:
      return false;
  }
}

export default createRule({
  name: "promise-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag `Promise<...>` used as a function return type. Prefer Effect.",
    },
    messages: {
      promiseReturn: "Promise<> return type — prefer Effect",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      TSTypeReference(node) {
        if (!isPromiseTypeReference(node)) return;
        if (!isReturnTypeAnnotation(node)) return;
        context.report({ node, messageId: "promiseReturn" });
      },
    };
  },
});
