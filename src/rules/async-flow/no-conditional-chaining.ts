import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

type FunctionNode =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

const BOUNDARY_NAME_RE = /^(decode|from|normalize|parse|read|resolve)[A-Z_]/;

export default createRule({
  name: "no-conditional-chaining",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag optional or nullable function parameters that are passed onward to another call before the function resolves the conditional shape.",
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
        .filter((argument): argument is TSESTree.Identifier =>
          argument.type === AST_NODE_TYPES.Identifier)
        .map((argument) => bindingForArgument(call, argument))
        .find((binding): binding is BindingMatch => binding !== null);
      if (offending !== undefined) flagBinding(offending);
    }

    function flagBinding(binding: BindingMatch): void {
      if (reported.has(binding.parameter)) return;
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
  if (owner === null) return null;
  if (isBoundaryNormalizer(owner)) return null;
  const parameter = unresolvedParameter(owner.params, argument.name);
  if (parameter === null) return null;
  if (resolvedBeforeCall(owner, argument.name, call)) return null;
  return { name: argument.name, parameter };
}

function unresolvedParameter(
  params: ReadonlyArray<TSESTree.Parameter>,
  name: string,
): TSESTree.Parameter | null {
  return params.find((p) => unresolvedParameterMatches(p, name)) ?? null;
}

function unresolvedParameterMatches(
  parameter: TSESTree.Parameter,
  name: string,
): boolean {
  return unresolvedParameterName(parameter) === name;
}

function enclosingFunction(node: TSESTree.Node): FunctionNode | null {
  for (let current = parentOf(node); current !== null; current = parentOf(current)) {
    if (isFunctionNode(current)) return current;
  }
  return null;
}

function isFunctionNode(node: TSESTree.Node): node is FunctionNode {
  return node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression;
}

function resolvedBeforeCall(
  owner: FunctionNode,
  name: string,
  call: TSESTree.CallExpression,
): boolean {
  const body = owner.body;
  if (body.type !== AST_NODE_TYPES.BlockStatement) return false;
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

function statementResolvesParameter(
  statement: TSESTree.Statement,
  name: string,
): boolean {
  if (statement.type === AST_NODE_TYPES.IfStatement) return isEarlyExitGuard(statement, name);
  if (statement.type === AST_NODE_TYPES.ExpressionStatement) {
    return expressionResolvesParameter(statement.expression, name);
  }
  if (statement.type === AST_NODE_TYPES.VariableDeclaration) {
    return statement.declarations.some((d) => declaratorShadowsName(d, name));
  }
  return false;
}

function declaratorShadowsName(
  declarator: TSESTree.VariableDeclarator,
  name: string,
): boolean {
  return declarator.id.type === AST_NODE_TYPES.Identifier && declarator.id.name === name;
}

function isEarlyExitGuard(statement: TSESTree.IfStatement, name: string): boolean {
  return testsParameterForNullish(statement.test, name) &&
    statementExitsEarly(statement.consequent);
}

function testsParameterForNullish(
  test: TSESTree.Expression,
  name: string,
): boolean {
  if (test.type === AST_NODE_TYPES.LogicalExpression) {
    return testsParameterForNullish(test.left, name) ||
      testsParameterForNullish(test.right, name);
  }
  if (test.type !== AST_NODE_TYPES.BinaryExpression) return false;
  if (!isNullishEqualityOperator(test.operator)) return false;
  return comparesIdentifierWithNullish(test.left, test.right, name);
}

function isNullishEqualityOperator(operator: string): boolean {
  return operator === "===" || operator === "!==" ||
    operator === "==" || operator === "!=";
}

function comparesIdentifierWithNullish(
  left: TSESTree.Expression | TSESTree.PrivateIdentifier,
  right: TSESTree.Expression | TSESTree.PrivateIdentifier,
  name: string,
): boolean {
  return (isIdentifierNamed(left, name) && isNullishLiteral(right)) ||
    (isIdentifierNamed(right, name) && isNullishLiteral(left));
}

function isNullishLiteral(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.Identifier && node.name === "undefined") return true;
  return node.type === AST_NODE_TYPES.Literal && node.value === null;
}

function statementExitsEarly(statement: TSESTree.Statement): boolean {
  if (statement.type === AST_NODE_TYPES.ReturnStatement) return true;
  if (statement.type === AST_NODE_TYPES.ThrowStatement) return true;
  if (statement.type === AST_NODE_TYPES.BlockStatement) {
    return statement.body.some(statementExitsEarly);
  }
  return false;
}

function expressionResolvesParameter(
  expression: TSESTree.Expression,
  name: string,
): boolean {
  if (expression.type !== AST_NODE_TYPES.AssignmentExpression) return false;
  if (!isIdentifierNamed(expression.left, name)) return false;
  return isResolvingAssignment(expression.operator);
}

function isResolvingAssignment(operator: string): boolean {
  return operator === "=" || operator === "??=" || operator === "||=";
}

function isIdentifierNamed(node: TSESTree.Node, name: string): boolean {
  return node.type === AST_NODE_TYPES.Identifier && node.name === name;
}

function unresolvedParameterName(parameter: TSESTree.Parameter): string | null {
  if (parameter.type === AST_NODE_TYPES.Identifier) {
    return identifierParameterIsUnresolved(parameter) ? parameter.name : null;
  }
  if (parameter.type === AST_NODE_TYPES.ObjectPattern) {
    return objectPatternUnresolvedName(parameter);
  }
  return null;
}

function identifierParameterIsUnresolved(parameter: TSESTree.Identifier): boolean {
  const annotation = parameter.typeAnnotation?.typeAnnotation;
  return parameter.optional ||
    (annotation !== undefined && typeAnnotationIsNullable(annotation));
}

function objectPatternUnresolvedName(parameter: TSESTree.ObjectPattern): string | null {
  const shape = parameter.typeAnnotation?.typeAnnotation;
  if (shape?.type !== AST_NODE_TYPES.TSTypeLiteral) return null;
  const candidate = parameter.properties
    .map((property) => unresolvedPropertyName(shape, property))
    .find((name): name is string => name !== null);
  return candidate ?? null;
}

function unresolvedPropertyName(
  shape: TSESTree.TSTypeLiteral,
  property: TSESTree.ObjectPattern["properties"][number],
): string | null {
  const name = objectPatternPropertyName(property);
  if (name === null) return null;
  return typeLiteralPropertyIsUnresolved(shape, name) ? name : null;
}

function objectPatternPropertyName(
  property: TSESTree.ObjectPattern["properties"][number],
): string | null {
  if (property.type !== AST_NODE_TYPES.Property) return null;
  if (property.value.type === AST_NODE_TYPES.Identifier) return property.value.name;
  return staticPropertyName(property.key);
}

function typeLiteralPropertyIsUnresolved(
  typeLiteral: TSESTree.TSTypeLiteral,
  name: string,
): boolean {
  const member = typeLiteral.members.find((m) => isPropertySignatureNamed(m, name));
  if (member === undefined) return false;
  return member.optional || propertySignatureIsNullable(member);
}

function isPropertySignatureNamed(
  member: TSESTree.TypeElement,
  name: string,
): member is TSESTree.TSPropertySignature {
  return member.type === AST_NODE_TYPES.TSPropertySignature &&
    propertySignatureName(member) === name;
}

function propertySignatureIsNullable(member: TSESTree.TSPropertySignature): boolean {
  const annotation = member.typeAnnotation?.typeAnnotation;
  return annotation !== undefined && typeAnnotationIsNullable(annotation);
}

function propertySignatureName(member: TSESTree.TSPropertySignature): string | null {
  return staticPropertyName(member.key);
}

function staticPropertyName(node: TSESTree.Node): string | null {
  if (node.type === AST_NODE_TYPES.Identifier) return node.name;
  if (node.type !== AST_NODE_TYPES.Literal) return null;
  return typeof node.value === "string" ? node.value : null;
}

function typeAnnotationIsNullable(node: TSESTree.TypeNode): boolean {
  if (node.type === AST_NODE_TYPES.TSUndefinedKeyword) return true;
  if (node.type === AST_NODE_TYPES.TSNullKeyword) return true;
  return node.type === AST_NODE_TYPES.TSUnionType &&
    node.types.some(typeAnnotationIsNullable);
}

function isBoundaryNormalizer(node: FunctionNode): boolean {
  const name = functionName(node);
  return name === null ? false : BOUNDARY_NAME_RE.test(name);
}

function functionName(node: FunctionNode): string | null {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) return node.id?.name ?? null;
  const expressionName = namedFunctionExpressionName(node);
  return expressionName ?? parentVariableDeclaratorName(node);
}

function namedFunctionExpressionName(node: FunctionNode): string | null {
  return node.type === AST_NODE_TYPES.FunctionExpression && node.id
    ? node.id.name
    : null;
}

function parentVariableDeclaratorName(node: FunctionNode): string | null {
  const parent = parentOf(node);
  if (parent?.type !== AST_NODE_TYPES.VariableDeclarator) return null;
  return parent.id.type === AST_NODE_TYPES.Identifier ? parent.id.name : null;
}

function parentOf(node: TSESTree.Node): TSESTree.Node | null {
  return (node as TSESTree.Node & { readonly parent?: TSESTree.Node }).parent ?? null;
}
