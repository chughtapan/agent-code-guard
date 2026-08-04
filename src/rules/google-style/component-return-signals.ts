/**
 * @file Resolves the return shapes that make a function a React component.
 */

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";

/** Runtime function forms that can define a component. */
export type ComponentFunctionNode = TSESTree.ArrowFunctionExpression |
  TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;

const COMPONENT_RETURN_TYPE_PATTERN =
  /\bJSX\.Element\b|\bReact(?:\.ReactElement|Element|\.JSX\.Element)\b/;
const REACT_NODE_RETURN_TYPE_PATTERN = /\bReact(?:\.ReactNode|Node)\b/;

/**
 * Resolves an identifier or JSX identifier to its lexical binding.
 * @param sourceCode ESLint scope information.
 * @param identifier Identifier to resolve.
 * @returns The lexical binding, or `null` for an unresolved global.
 */
export function resolveScopeVariable(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier | TSESTree.JSXIdentifier,
): TSESLint.Scope.Variable | null {
  let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) {
      return variable;
    }
    scope = scope.upper;
  }
  return null;
}

/**
 * Tests an explicit return type for a React component result.
 * @param sourceCode Source text provider.
 * @param node Function whose return type is inspected.
 * @param upperCamel Whether the function already uses component casing.
 * @returns Whether the annotation identifies a component result.
 */
export function returnTypeSignalsComponent(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: ComponentFunctionNode,
  upperCamel: boolean,
): boolean {
  const returnType = node.returnType === undefined ? "" : sourceCode.getText(node.returnType);
  return COMPONENT_RETURN_TYPE_PATTERN.test(returnType) ||
    (upperCamel && REACT_NODE_RETURN_TYPE_PATTERN.test(returnType));
}

function isReactImport(definition: TSESLint.Scope.Definition): boolean {
  return definition.type === "ImportBinding" &&
    definition.parent.type === AST_NODE_TYPES.ImportDeclaration &&
    definition.parent.source.value === "react";
}

function isReactReference(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
): boolean {
  const variable = resolveScopeVariable(sourceCode, identifier);
  if (variable === null || variable.defs.length === 0) {
    return identifier.name === "React";
  }
  return variable.defs.some(isReactImport);
}

function isImportedCreateElement(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
): boolean {
  const variable = resolveScopeVariable(sourceCode, identifier);
  return variable?.defs.some((definition) => {
    if (!isReactImport(definition) ||
      definition.node.type !== AST_NODE_TYPES.ImportSpecifier) {
      return false;
    }
    const imported = definition.node.imported;
    return imported.type === AST_NODE_TYPES.Identifier
      ? imported.name === "createElement"
      : imported.value === "createElement";
  }) ?? false;
}

function isNamedMember(node: TSESTree.MemberExpression, name: string): boolean {
  const property = node.property;
  return property.type === AST_NODE_TYPES.Literal
    ? property.value === name
    : !node.computed &&
    property.type === AST_NODE_TYPES.Identifier &&
    property.name === name;
}

function isReactCreateElement(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Node,
): boolean {
  if (node.type !== AST_NODE_TYPES.CallExpression) {
    return false;
  }
  if (node.callee.type === AST_NODE_TYPES.Identifier) {
    return isImportedCreateElement(sourceCode, node.callee);
  }
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }
  const owner = node.callee.object;
  return owner.type === AST_NODE_TYPES.Identifier &&
    isReactReference(sourceCode, owner) &&
    isNamedMember(node.callee, "createElement");
}

function transparentExpression(node: TSESTree.Expression): TSESTree.Expression | null {
  if (node.type === AST_NODE_TYPES.TSAsExpression ||
    node.type === AST_NODE_TYPES.TSTypeAssertion ||
    node.type === AST_NODE_TYPES.TSNonNullExpression) {
    return node.expression;
  }
  return node.type === AST_NODE_TYPES.AwaitExpression ? node.argument : null;
}

function componentChildren(node: TSESTree.Expression): readonly TSESTree.Expression[] {
  if (node.type === AST_NODE_TYPES.ConditionalExpression) {
    return [node.consequent, node.alternate];
  }
  if (node.type === AST_NODE_TYPES.LogicalExpression) {
    return [node.left, node.right];
  }
  if (node.type === AST_NODE_TYPES.SequenceExpression) {
    return node.expressions.slice(-1);
  }
  return node.type === AST_NODE_TYPES.ArrayExpression
    ? node.elements.filter(
      (element): element is TSESTree.Expression =>
        element !== null && element.type !== AST_NODE_TYPES.SpreadElement,
    )
    : [];
}

function returnedValues(
  node: ComponentFunctionNode,
  recorded: ReadonlyMap<
    ComponentFunctionNode,
    ReadonlyArray<TSESTree.Expression | null>
  >,
): ReadonlyArray<TSESTree.Expression | null> {
  if (node.type === AST_NODE_TYPES.ArrowFunctionExpression &&
    node.body.type !== AST_NODE_TYPES.BlockStatement) {
    return [node.body];
  }
  return recorded.get(node) ?? [];
}

function mappedCallbackHasComponentSignal(
  sourceCode: Readonly<TSESLint.SourceCode>,
  recordedReturns: ReadonlyMap<
    ComponentFunctionNode,
    ReadonlyArray<TSESTree.Expression | null>
  >,
  node: TSESTree.CallExpression,
): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression ||
    !isNamedMember(node.callee, "map")) {
    return false;
  }
  return node.arguments.some((argument) =>
    argument.type !== AST_NODE_TYPES.SpreadElement &&
    (argument.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      argument.type === AST_NODE_TYPES.FunctionExpression) &&
    functionHasComponentReturnSignal(sourceCode, recordedReturns, argument)
  );
}

function expressionHasComponentSignal(
  sourceCode: Readonly<TSESLint.SourceCode>,
  recordedReturns: ReadonlyMap<
    ComponentFunctionNode,
    ReadonlyArray<TSESTree.Expression | null>
  >,
  node: TSESTree.Expression,
): boolean {
  if (node.type === AST_NODE_TYPES.JSXElement ||
    node.type === AST_NODE_TYPES.JSXFragment ||
    isReactCreateElement(sourceCode, node)) {
    return true;
  }
  if (node.type === AST_NODE_TYPES.CallExpression &&
    mappedCallbackHasComponentSignal(sourceCode, recordedReturns, node)) {
    return true;
  }
  const transparent = transparentExpression(node);
  if (transparent !== null) {
    return expressionHasComponentSignal(sourceCode, recordedReturns, transparent);
  }
  return componentChildren(node).some((child) =>
    expressionHasComponentSignal(sourceCode, recordedReturns, child)
  );
}

/**
 * Tests whether a function returns JSX, React.createElement, or JSX-producing
 * mapped callbacks.
 * @param sourceCode Source and scope information.
 * @param recordedReturns Return statements grouped by their owning function.
 * @param node Function whose return values are inspected.
 * @returns Whether a returned value signals a component.
 */
export function functionHasComponentReturnSignal(
  sourceCode: Readonly<TSESLint.SourceCode>,
  recordedReturns: ReadonlyMap<
    ComponentFunctionNode,
    ReadonlyArray<TSESTree.Expression | null>
  >,
  node: ComponentFunctionNode,
): boolean {
  return returnedValues(node, recordedReturns).some((returned) =>
    returned !== null &&
    expressionHasComponentSignal(sourceCode, recordedReturns, returned)
  );
}
