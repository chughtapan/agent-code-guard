/**
 * @file Distinguishes UpperCamelCase TSX components from lowerCamelCase
 * ordinary functions.
 */

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import {
  type ComponentFunctionNode as CandidateFunction,
  functionHasComponentReturnSignal,
  resolveScopeVariable,
  returnTypeSignalsComponent,
} from "./component-return-signals.js";

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

function isFunctionNode(node: TSESTree.Node | null): node is CandidateFunction {
  return node?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node?.type === AST_NODE_TYPES.FunctionDeclaration ||
    node?.type === AST_NODE_TYPES.FunctionExpression;
}

function isFunctionInitializer(node: TSESTree.Node | null): node is CandidateFunction {
  return node?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node?.type === AST_NODE_TYPES.FunctionExpression;
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

function isComponent(
  sourceCode: Readonly<TSESLint.SourceCode>,
  state: ClassificationState,
  candidate: FunctionCandidate,
  upperCamel: boolean,
): boolean {
  if (candidate.binding !== null && state.jsxBindings.has(candidate.binding)) {
    return true;
  }
  if (returnTypeSignalsComponent(sourceCode, candidate.functionNode, upperCamel)) {
    return true;
  }
  return functionHasComponentReturnSignal(
    sourceCode,
    state.recordedReturns,
    candidate.functionNode,
  );
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
        const binding = resolveScopeVariable(sourceCode, node.name);
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
