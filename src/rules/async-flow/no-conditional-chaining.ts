/**
 * @file Prevents unresolved optional parameters from propagating through conditional chains.
 */

import { type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import { unresolvedParameter } from "./conditional-chaining-parameters.js";

type FunctionNode =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

const BOUNDARY_NAME_RE = /^(decode|from|normalize|parse|read|resolve)[A-Z_]/;

/**
 * Enforces the `no-conditional-chaining` Agent Code Guard rule.
 */
export const noConditionalChaining = createRule({
  name: "no-conditional-chaining",
  meta: {
    type: "problem",
    docs: {
      description:
        "Conditional chains (`x?.y?.z`) hide the optionality the type system would have made exhaustive; lift the absence into a discriminant.",
      url: PRINCIPLE_URL.EXHAUSTIVENESS,
    },
    messages: {
      conditionalChaining:
        "Resolve optional/nullable parameter {{name}} before passing it to another function. Do not propagate unresolved conditional inputs down the call chain.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const reported = new WeakSet<TSESTree.Node>();

    function inspectCall(call: TSESTree.CallExpression): void {
      const offending = call.arguments
        .filter(
          (argument): argument is TSESTree.Identifier =>
            argument.type === AST_NODE_TYPES.Identifier,
        )
        .map((argument) => bindingForArgument(call, argument))
        .find((binding): binding is BindingMatch => binding !== null);
      if (offending !== undefined) {
        flagBinding(offending);
      }
    }

    function flagBinding(binding: BindingMatch): void {
      if (reported.has(binding.parameter)) {
        return;
      }
      reported.add(binding.parameter);
      context.report({
        node: binding.parameter,
        messageId: "conditionalChaining",
        data: { name: binding.name },
      });
    }

    return { CallExpression: inspectCall };
  },
});

interface BindingMatch {
  readonly name: string;
  readonly parameter: TSESTree.Parameter;
}

function bindingForArgument(
  call: TSESTree.CallExpression,
  argument: TSESTree.Identifier,
): BindingMatch | null {
  const owner = enclosingFunction(call);
  if (owner === null) {
    return null;
  }
  if (isBoundaryNormalizer(owner)) {
    return null;
  }
  const parameter = unresolvedParameter(owner.params, argument.name);
  if (parameter === null) {
    return null;
  }
  if (resolvedBeforeCall(owner, argument.name, call)) {
    return null;
  }
  return { name: argument.name, parameter };
}

function enclosingFunction(node: TSESTree.Node): FunctionNode | null {
  for (let current = parentOf(node); current !== null; current = parentOf(current)) {
    if (isFunctionNode(current)) {
      return current;
    }
  }
  return null;
}

function isFunctionNode(node: TSESTree.Node): node is FunctionNode {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression
  );
}

function resolvedBeforeCall(
  owner: FunctionNode,
  name: string,
  call: TSESTree.CallExpression,
): boolean {
  const body = owner.body;
  if (body.type !== AST_NODE_TYPES.BlockStatement) {
    return false;
  }
  return body.body
    .filter((statement) => statementEndsBefore(statement, call))
    .some((statement) => statementResolvesParameter(statement, name));
}

function statementEndsBefore(
  statement: TSESTree.Statement,
  call: TSESTree.CallExpression,
): boolean {
  return statement.range[1] <= call.range[0];
}

function statementResolvesParameter(statement: TSESTree.Statement, name: string): boolean {
  if (statement.type === AST_NODE_TYPES.IfStatement) {
    return isEarlyExitGuard(statement, name);
  }
  if (statement.type === AST_NODE_TYPES.ExpressionStatement) {
    return expressionResolvesParameter(statement.expression, name);
  }
  if (statement.type === AST_NODE_TYPES.VariableDeclaration) {
    return statement.declarations.some((d) => declaratorShadowsName(d, name));
  }
  return false;
}

function declaratorShadowsName(declarator: TSESTree.VariableDeclarator, name: string): boolean {
  return declarator.id.type === AST_NODE_TYPES.Identifier && declarator.id.name === name;
}

function isEarlyExitGuard(statement: TSESTree.IfStatement, name: string): boolean {
  return (
    testsParameterForNullish(statement.test, name) && statementExitsEarly(statement.consequent)
  );
}

function testsParameterForNullish(test: TSESTree.Expression, name: string): boolean {
  if (test.type === AST_NODE_TYPES.LogicalExpression) {
    return testsParameterForNullish(test.left, name) || testsParameterForNullish(test.right, name);
  }
  if (test.type !== AST_NODE_TYPES.BinaryExpression) {
    return false;
  }
  if (!isNullishEqualityOperator(test.operator)) {
    return false;
  }
  return comparesIdentifierWithNullish(test.left, test.right, name);
}

function isNullishEqualityOperator(operator: string): boolean {
  return operator === "===" || operator === "!==" || operator === "==" || operator === "!=";
}

function comparesIdentifierWithNullish(
  left: TSESTree.Expression | TSESTree.PrivateIdentifier,
  right: TSESTree.Expression | TSESTree.PrivateIdentifier,
  name: string,
): boolean {
  return (
    (isIdentifierNamed(left, name) && isNullishLiteral(right)) ||
    (isIdentifierNamed(right, name) && isNullishLiteral(left))
  );
}

function isNullishLiteral(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.Identifier && node.name === "undefined") {
    return true;
  }
  return node.type === AST_NODE_TYPES.Literal && node.value === null;
}

function statementExitsEarly(statement: TSESTree.Statement): boolean {
  if (statement.type === AST_NODE_TYPES.ReturnStatement) {
    return true;
  }
  if (statement.type === AST_NODE_TYPES.ThrowStatement) {
    return true;
  }
  if (statement.type === AST_NODE_TYPES.BlockStatement) {
    return statement.body.some(statementExitsEarly);
  }
  return false;
}

function expressionResolvesParameter(expression: TSESTree.Expression, name: string): boolean {
  if (expression.type !== AST_NODE_TYPES.AssignmentExpression) {
    return false;
  }
  if (!isIdentifierNamed(expression.left, name)) {
    return false;
  }
  return isResolvingAssignment(expression.operator);
}

function isResolvingAssignment(operator: string): boolean {
  return operator === "=" || operator === "??=" || operator === "||=";
}

function isIdentifierNamed(node: TSESTree.Node, name: string): boolean {
  return node.type === AST_NODE_TYPES.Identifier && node.name === name;
}

function isBoundaryNormalizer(node: FunctionNode): boolean {
  const name = functionName(node);
  return name === null ? false : BOUNDARY_NAME_RE.test(name);
}

function functionName(node: FunctionNode): string | null {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
    return node.id?.name ?? null;
  }
  const expressionName = namedFunctionExpressionName(node);
  return expressionName ?? parentVariableDeclaratorName(node);
}

function namedFunctionExpressionName(node: FunctionNode): string | null {
  return node.type === AST_NODE_TYPES.FunctionExpression && node.id ? node.id.name : null;
}

function parentVariableDeclaratorName(node: FunctionNode): string | null {
  const parent = parentOf(node);
  if (parent?.type !== AST_NODE_TYPES.VariableDeclarator) {
    return null;
  }
  return parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.name : null;
}

function parentOf(node: TSESTree.Node): TSESTree.Node | null {
  return node.parent ?? null;
}
