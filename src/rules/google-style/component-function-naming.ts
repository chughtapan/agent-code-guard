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
  readonly functionNode: CandidateFunction;
  readonly globalVariable: boolean;
  readonly name: TSESTree.Identifier;
  readonly variable: boolean;
}

const CONSTANT_CASE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const COMPONENT_RETURN_TYPE_PATTERN =
  /\b(?:JSX\.)?Element\b|\bReact(?:Element|Node)\b|\bReact\.JSX\.Element\b/;

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
  if (node !== root && isFunctionInitializer(node)) {
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

function jsxTagName(node: TSESTree.JSXTagNameExpression): string | null {
  return node.type === AST_NODE_TYPES.JSXIdentifier ? node.name : null;
}

function returnTypeSignalsComponent(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: CandidateFunction,
): boolean {
  return (
    node.returnType !== undefined &&
    COMPONENT_RETURN_TYPE_PATTERN.test(sourceCode.getText(node.returnType))
  );
}

function isComponent(
  sourceCode: Readonly<TSESLint.SourceCode>,
  jsxTags: ReadonlySet<string>,
  candidate: FunctionCandidate,
): boolean {
  return (
    jsxTags.has(candidate.name.name) ||
    containsJsx(candidate.functionNode, candidate.functionNode) ||
    returnTypeSignalsComponent(sourceCode, candidate.functionNode)
  );
}

function reportCandidate(
  context: Readonly<
    TSESLint.RuleContext<"componentUpperCamel" | "ordinaryLowerCamel", []>
  >,
  jsxTags: ReadonlySet<string>,
  candidate: FunctionCandidate,
): void {
  const component = isComponent(context.sourceCode, jsxTags, candidate);
  const upperCamel = /^\p{Lu}/u.test(candidate.name.name);
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
          functionNode: node.init,
          globalVariable: topLevelVariable(node),
          name: node.id,
          variable: true,
        });
      },
    };
  },
});
