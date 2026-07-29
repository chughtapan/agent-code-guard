/**
 * @file Distinguishes UpperCamelCase TSX components from lowerCamelCase
 * ordinary functions.
 */

import { type TSESLint, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

type CandidateFunction = TSESTree.ArrowFunctionExpression |
  TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;

interface FunctionCandidate {
  readonly binding: TSESLint.Scope.Variable | null;
  readonly functionNode: CandidateFunction;
  readonly globalVariable: boolean;
  readonly name: TSESTree.Identifier;
  readonly variable: boolean;
}

interface ClassificationState {
  readonly jsxBindings: ReadonlySet<TSESLint.Scope.Variable>;
  readonly recordedReturns: ReadonlyMap<
    CandidateFunction,
    ReadonlyArray<TSESTree.Expression | null>
  >;
}

const CONSTANT_CASE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const COMPONENT_RETURN_TYPE_PATTERN = /\bJSX\.Element\b|\bReact(?:\.ReactElement|Element|\.JSX\.Element)\b/;
const REACT_NODE_RETURN_TYPE_PATTERN = /\bReact(?:\.ReactNode|Node)\b/;

function isFunctionNode(node: TSESTree.Node | null): node is CandidateFunction {
  return node?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node?.type === AST_NODE_TYPES.FunctionDeclaration ||
    node?.type === AST_NODE_TYPES.FunctionExpression;
}

function isFunctionInitializer(node: TSESTree.Node | null): node is CandidateFunction {
  return node?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node?.type === AST_NODE_TYPES.FunctionExpression;
}

type NamedIdentifier = TSESTree.Identifier | TSESTree.JSXIdentifier;

function resolveVariable(sourceCode: Readonly<TSESLint.SourceCode>, identifier: NamedIdentifier): TSESLint.Scope.Variable | null {
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

function declaredVariable(
  sourceCode: Readonly<TSESLint.SourceCode>,
  declaration: TSESTree.FunctionDeclaration | TSESTree.VariableDeclarator,
  name: string,
): TSESLint.Scope.Variable | null {
  return sourceCode.getDeclaredVariables(declaration).find(
    (variable) => variable.name === name,
  ) ?? null;
}

function containingFunction(node: TSESTree.Node): CandidateFunction | null {
  let current: TSESTree.Node | null | undefined = node.parent;
  while (current != null && !isFunctionNode(current)) {
    current = current.parent;
  }
  const candidate = current ?? null;
  return isFunctionNode(candidate) ? candidate : null;
}

function returnedValues(
  node: CandidateFunction,
  recorded: ReadonlyMap<CandidateFunction, ReadonlyArray<TSESTree.Expression | null>>,
): ReadonlyArray<TSESTree.Expression | null> {
  if (node.type === AST_NODE_TYPES.ArrowFunctionExpression &&
    node.body.type !== AST_NODE_TYPES.BlockStatement) {
    return [node.body];
  }
  return recorded.get(node) ?? [];
}

function topLevelVariable(node: TSESTree.VariableDeclarator): boolean {
  const declaration = node.parent;
  if (declaration.type !== AST_NODE_TYPES.VariableDeclaration) {
    return false;
  }
  const parent = declaration.parent;
  return parent.type === AST_NODE_TYPES.Program ||
    (parent.type === AST_NODE_TYPES.ExportNamedDeclaration &&
      parent.parent.type === AST_NODE_TYPES.Program);
}

function returnTypeSignalsComponent(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: CandidateFunction,
  upperCamel: boolean,
): boolean {
  const returnType = node.returnType === undefined ? "" : sourceCode.getText(node.returnType);
  return COMPONENT_RETURN_TYPE_PATTERN.test(returnType) ||
    (upperCamel && REACT_NODE_RETURN_TYPE_PATTERN.test(returnType));
}

function isCreateElementProperty(node: TSESTree.MemberExpression): boolean {
  const property = node.property;
  return property.type === AST_NODE_TYPES.Literal
    ? property.value === "createElement"
    : !node.computed &&
    property.type === AST_NODE_TYPES.Identifier &&
    property.name === "createElement";
}

function isReactImport(definition: TSESLint.Scope.Definition): boolean {
  return definition.type === "ImportBinding" &&
    definition.parent.type === AST_NODE_TYPES.ImportDeclaration &&
    definition.parent.source.value === "react";
}

function isReactReference(sourceCode: Readonly<TSESLint.SourceCode>, identifier: TSESTree.Identifier): boolean {
  const variable = resolveVariable(sourceCode, identifier);
  return identifier.name === "React" && (variable === null ||
    variable.defs.length === 0 || variable.defs.some(isReactImport));
}

function isReactCreateElement(sourceCode: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): boolean {
  if (node.type !== AST_NODE_TYPES.CallExpression ||
    node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }
  const owner = node.callee.object;
  return owner.type === AST_NODE_TYPES.Identifier &&
    isReactReference(sourceCode, owner) &&
    isCreateElementProperty(node.callee);
}

function transparentExpression(node: TSESTree.Expression): TSESTree.Expression | null {
  if (node.type === AST_NODE_TYPES.TSAsExpression ||
    node.type === AST_NODE_TYPES.TSTypeAssertion ||
    node.type === AST_NODE_TYPES.TSNonNullExpression) {
    return node.expression;
  }
  return node.type === AST_NODE_TYPES.AwaitExpression ? node.argument : null;
}

function arrayExpressions(node: TSESTree.ArrayExpression): readonly TSESTree.Expression[] {
  return node.elements.filter(
    (element): element is TSESTree.Expression =>
      element !== null && element.type !== AST_NODE_TYPES.SpreadElement,
  );
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
  return node.type === AST_NODE_TYPES.ArrayExpression ? arrayExpressions(node) : [];
}

function directComponentSignal(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
): boolean {
  return node.type === AST_NODE_TYPES.JSXElement ||
    node.type === AST_NODE_TYPES.JSXFragment ||
    isReactCreateElement(sourceCode, node);
}

function returnedExpressionHasComponentSignal(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
): boolean {
  const transparent = transparentExpression(node);
  return directComponentSignal(sourceCode, node) ||
    (transparent !== null
      ? returnedExpressionHasComponentSignal(sourceCode, transparent)
      : componentChildren(node).some((child) =>
        returnedExpressionHasComponentSignal(sourceCode, child)
      ));
}

function isComponent(
  sourceCode: Readonly<TSESLint.SourceCode>,
  state: ClassificationState,
  candidate: FunctionCandidate,
  upperCamel: boolean,
): boolean {
  const returned = returnedValues(candidate.functionNode, state.recordedReturns);
  if (candidate.binding !== null && state.jsxBindings.has(candidate.binding)) {
    return true;
  }
  if (returnTypeSignalsComponent(sourceCode, candidate.functionNode, upperCamel)) {
    return true;
  }
  if (returned.some((expression) =>
    expression !== null && returnedExpressionHasComponentSignal(sourceCode, expression)
  )) {
    return true;
  }
  return false;
}

function reportCandidate(
  context: Readonly<
    TSESLint.RuleContext<"componentUpperCamel" | "ordinaryLowerCamel", []>
  >,
  state: ClassificationState,
  candidate: FunctionCandidate,
): void {
  const upperCamel = /^\p{Lu}/u.test(candidate.name.name);
  const component = isComponent(context.sourceCode, state, candidate, upperCamel);
  if (component && !upperCamel) {
    context.report({ node: candidate.name, messageId: "componentUpperCamel" });
    return;
  }
  const globalConstant =
    candidate.variable &&
    candidate.globalVariable &&
    CONSTANT_CASE_PATTERN.test(candidate.name.name);
  if (!component && upperCamel && !globalConstant) {
    context.report({ node: candidate.name, messageId: "ordinaryLowerCamel" });
  }
}

/**
 * Enforces Google Style's TSX-specific UpperCamelCase exception without
 * allowing ordinary functions to use type-like names.
 */
export const componentFunctionNaming = createRule({
  name: "component-function-naming",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "TSX component functions use UpperCamelCase while ordinary functions remain lowerCamelCase.",
      url: PRINCIPLE_URL.DISCIPLINE,
    },
    messages: {
      componentUpperCamel:
        "TSX component functions must use UpperCamelCase.",
      ordinaryLowerCamel:
        "Only TSX component functions may use UpperCamelCase; ordinary functions must use lowerCamelCase.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    const candidates: FunctionCandidate[] = [];
    const jsxBindings = new Set<TSESLint.Scope.Variable>();
    const recordedReturns =
      new Map<CandidateFunction, Array<TSESTree.Expression | null>>();
    const state: ClassificationState = { jsxBindings, recordedReturns };

    return {
      FunctionDeclaration(node) {
        if (node.id === null) {
          return;
        }
        candidates.push({ binding: declaredVariable(sourceCode, node, node.id.name),
          functionNode: node, globalVariable: false, name: node.id, variable: false });
      },
      JSXOpeningElement(node) {
        if (node.name.type !== AST_NODE_TYPES.JSXIdentifier) {
          return;
        }
        const binding = resolveVariable(sourceCode, node.name);
        if (binding !== null) {
          jsxBindings.add(binding);
        }
      },
      "Program:exit"() {
        for (const candidate of candidates) {
          reportCandidate(context, state, candidate);
        }
      },
      ReturnStatement(node) {
        const owner = containingFunction(node);
        if (owner === null) {
          return;
        }
        const values = recordedReturns.get(owner) ?? [];
        values.push(node.argument);
        recordedReturns.set(owner, values);
      },
      VariableDeclarator(node) {
        if (node.id.type !== AST_NODE_TYPES.Identifier || !isFunctionInitializer(node.init)) {
          return;
        }
        candidates.push({ binding: declaredVariable(sourceCode, node, node.id.name),
          functionNode: node.init,
          globalVariable: topLevelVariable(node), name: node.id, variable: true });
      },
    };
  },
});
