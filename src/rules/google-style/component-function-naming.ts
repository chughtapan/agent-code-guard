/**
 * @file Distinguishes UpperCamelCase TSX components from lowerCamelCase
 * ordinary functions.
 */

import { type TSESLint, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

type CandidateFunction =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

interface FunctionCandidate {
  readonly exported: boolean;
  readonly functionNode: CandidateFunction;
  readonly globalVariable: boolean;
  readonly name: TSESTree.Identifier;
  readonly variable: boolean;
}

const CONSTANT_CASE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const COMPONENT_RETURN_TYPE_PATTERN =
  /\bJSX\.Element\b|\bReact(?:\.ReactElement|Element|\.JSX\.Element)\b/;
const REACT_NODE_RETURN_TYPE_PATTERN = /\bReact(?:\.ReactNode|Node)\b/;

function isFunctionNode(node: TSESTree.Node | null): node is CandidateFunction {
  return (
    node?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node?.type === AST_NODE_TYPES.FunctionDeclaration ||
    node?.type === AST_NODE_TYPES.FunctionExpression
  );
}

function isFunctionInitializer(node: TSESTree.Node | null): node is CandidateFunction {
  return (
    node?.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node?.type === AST_NODE_TYPES.FunctionExpression
  );
}

function isNode(value: unknown): value is TSESTree.Node {
  return typeof value === "object" && value !== null && "type" in value;
}

function containsJsxValue(value: unknown, root: CandidateFunction): boolean {
  if (Array.isArray(value)) {
    return value.some((child) => containsJsxValue(child, root));
  }
  if (!isNode(value)) {
    return false;
  }
  return containsJsx(value, root);
}

function containsJsx(node: TSESTree.Node, root: CandidateFunction): boolean {
  if (
    node.type === AST_NODE_TYPES.JSXElement ||
    node.type === AST_NODE_TYPES.JSXFragment
  ) {
    return true;
  }
  if (node !== root && isFunctionNode(node)) {
    return false;
  }
  return Object.entries(node).some(
    ([key, value]) => key !== "parent" && containsJsxValue(value, root),
  );
}

function topLevelVariable(node: TSESTree.VariableDeclarator): boolean {
  const declaration = node.parent;
  if (declaration.type !== AST_NODE_TYPES.VariableDeclaration) {
    return false;
  }
  const parent = declaration.parent;
  return (
    parent.type === AST_NODE_TYPES.Program ||
    (parent.type === AST_NODE_TYPES.ExportNamedDeclaration &&
      parent.parent.type === AST_NODE_TYPES.Program)
  );
}

function exportedVariable(node: TSESTree.VariableDeclarator): boolean {
  const declaration = node.parent;
  return (
    declaration.type === AST_NODE_TYPES.VariableDeclaration &&
    declaration.parent.type === AST_NODE_TYPES.ExportNamedDeclaration
  );
}

function exportedFunction(node: TSESTree.FunctionDeclaration): boolean {
  return (
    node.parent.type === AST_NODE_TYPES.ExportNamedDeclaration ||
    node.parent.type === AST_NODE_TYPES.ExportDefaultDeclaration
  );
}

function jsxTagName(node: TSESTree.JSXTagNameExpression): string | null {
  return node.type === AST_NODE_TYPES.JSXIdentifier ? node.name : null;
}

function returnTypeSignalsComponent(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: CandidateFunction,
  upperCamel: boolean,
): boolean {
  if (node.returnType === undefined) {
    return false;
  }
  const returnType = sourceCode.getText(node.returnType);
  return (
    COMPONENT_RETURN_TYPE_PATTERN.test(returnType) ||
    (upperCamel && REACT_NODE_RETURN_TYPE_PATTERN.test(returnType))
  );
}

function isCreateElementProperty(node: TSESTree.MemberExpression): boolean {
  const property = node.property;
  if (property.type === AST_NODE_TYPES.Literal) {
    return property.value === "createElement";
  }
  return !node.computed &&
    property.type === AST_NODE_TYPES.Identifier &&
    property.name === "createElement";
}

function isReactCreateElement(node: TSESTree.Node): boolean {
  if (
    node.type !== AST_NODE_TYPES.CallExpression ||
    node.callee.type !== AST_NODE_TYPES.MemberExpression
  ) {
    return false;
  }
  const owner = node.callee.object;
  return owner.type === AST_NODE_TYPES.Identifier &&
    owner.name === "React" &&
    isCreateElementProperty(node.callee);
}

function isNullLiteral(node: TSESTree.Node): boolean {
  return node.type === AST_NODE_TYPES.Literal && node.value === null;
}

function containsDirectReturnValue(
  value: unknown,
  root: CandidateFunction,
  predicate: (node: TSESTree.Node) => boolean,
): boolean {
  if (Array.isArray(value)) {
    return value.some((child) => containsDirectReturnValue(child, root, predicate));
  }
  if (!isNode(value)) {
    return false;
  }
  if (value !== root && isFunctionNode(value)) {
    return false;
  }
  if (
    value.type === AST_NODE_TYPES.ReturnStatement &&
    value.argument !== null &&
    predicate(value.argument)
  ) {
    return true;
  }
  return Object.entries(value).some(
    ([key, child]) =>
      key !== "parent" && containsDirectReturnValue(child, root, predicate),
  );
}

function directlyReturns(
  node: CandidateFunction,
  predicate: (value: TSESTree.Node) => boolean,
): boolean {
  if (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression &&
    node.expression &&
    predicate(node.body)
  ) {
    return true;
  }
  return containsDirectReturnValue(node.body, node, predicate);
}

function isComponent(
  sourceCode: Readonly<TSESLint.SourceCode>,
  jsxTags: ReadonlySet<string>,
  candidate: FunctionCandidate,
  upperCamel: boolean,
): boolean {
  if (
    jsxTags.has(candidate.name.name) ||
    containsJsx(candidate.functionNode, candidate.functionNode)
  ) {
    return true;
  }
  if (returnTypeSignalsComponent(sourceCode, candidate.functionNode, upperCamel)) {
    return true;
  }
  if (directlyReturns(candidate.functionNode, isReactCreateElement)) {
    return true;
  }
  return candidate.exported &&
    upperCamel &&
    directlyReturns(candidate.functionNode, isNullLiteral);
}

function reportCandidate(
  context: Readonly<
    TSESLint.RuleContext<"componentUpperCamel" | "ordinaryLowerCamel", []>
  >,
  jsxTags: ReadonlySet<string>,
  candidate: FunctionCandidate,
): void {
  const upperCamel = /^\p{Lu}/u.test(candidate.name.name);
  const component = isComponent(context.sourceCode, jsxTags, candidate, upperCamel);
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
    const candidates: FunctionCandidate[] = [];
    const jsxTags = new Set<string>();

    return {
      FunctionDeclaration(node) {
        if (node.id === null) {
          return;
        }
        candidates.push({
          exported: exportedFunction(node),
          functionNode: node,
          globalVariable: false,
          name: node.id,
          variable: false,
        });
      },
      JSXOpeningElement(node) {
        const name = jsxTagName(node.name);
        if (name !== null) {
          jsxTags.add(name);
        }
      },
      "Program:exit"() {
        for (const candidate of candidates) {
          reportCandidate(context, jsxTags, candidate);
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== AST_NODE_TYPES.Identifier || !isFunctionInitializer(node.init)) {
          return;
        }
        candidates.push({
          exported: exportedVariable(node),
          functionNode: node.init,
          globalVariable: topLevelVariable(node),
          name: node.id,
          variable: true,
        });
      },
    };
  },
});
