/**
 * @file Google-style expression rules for safe parameter defaults.
 */

import { type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

const PURE_LEAF_TYPES: ReadonlySet<string> = new Set([
  AST_NODE_TYPES.Identifier,
  AST_NODE_TYPES.Literal,
]);

function isPureArray(node: TSESTree.ArrayExpression): boolean {
  return node.elements.every((element) => {
    if (element === null) {
      return true;
    }
    if (element.type === AST_NODE_TYPES.SpreadElement) {
      return false;
    }
    return isPureDefault(element);
  });
}

function isPureObject(node: TSESTree.ObjectExpression): boolean {
  return node.properties.every((property) => {
    if (property.type !== AST_NODE_TYPES.Property) {
      return false;
    }
    if (property.kind !== "init" || property.computed) {
      return false;
    }
    if (property.value.type === AST_NODE_TYPES.AssignmentPattern) {
      return false;
    }
    return isPureDefault(property.value);
  });
}

function isTransparentTypeExpression(
  node: TSESTree.Node,
): node is
  | TSESTree.TSAsExpression
  | TSESTree.TSInstantiationExpression
  | TSESTree.TSNonNullExpression
  | TSESTree.TSTypeAssertion {
  if (node.type === AST_NODE_TYPES.TSAsExpression) {
    return true;
  }
  if (node.type === AST_NODE_TYPES.TSInstantiationExpression) {
    return true;
  }
  if (node.type === AST_NODE_TYPES.TSNonNullExpression) {
    return true;
  }
  return node.type === AST_NODE_TYPES.TSTypeAssertion;
}

function isPureComposite(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.ArrayExpression) {
    return isPureArray(node);
  }
  if (isBinaryLike(node)) {
    return isPureDefault(node.left) && isPureDefault(node.right);
  }
  if (node.type === AST_NODE_TYPES.ConditionalExpression) {
    return (
      isPureDefault(node.test) && isPureDefault(node.consequent) && isPureDefault(node.alternate)
    );
  }
  return node.type === AST_NODE_TYPES.ObjectExpression && isPureObject(node);
}

function isBinaryLike(
  node: TSESTree.Node,
): node is TSESTree.BinaryExpression | TSESTree.LogicalExpression {
  return (
    node.type === AST_NODE_TYPES.BinaryExpression || node.type === AST_NODE_TYPES.LogicalExpression
  );
}

function isPureDefault(node: TSESTree.Node): boolean {
  if (PURE_LEAF_TYPES.has(node.type)) {
    return true;
  }
  if (isPureComposite(node)) {
    return true;
  }
  if (node.type === AST_NODE_TYPES.SequenceExpression) {
    return node.expressions.every(isPureDefault);
  }
  if (node.type === AST_NODE_TYPES.TemplateLiteral) {
    return node.expressions.length === 0;
  }
  if (isTransparentTypeExpression(node)) {
    return isPureDefault(node.expression);
  }
  if (node.type === AST_NODE_TYPES.UnaryExpression) {
    return node.operator !== "delete" && isPureDefault(node.argument);
  }
  return false;
}

function isFunctionNode(node: TSESTree.Node): node is TSESTree.FunctionLike {
  return isRuntimeFunctionNode(node) || isDeclarationOnlyFunctionNode(node);
}

function isRuntimeFunctionNode(
  node: TSESTree.Node,
): node is
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression {
  if (node.type === AST_NODE_TYPES.ArrowFunctionExpression) {
    return true;
  }
  return (
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression
  );
}

function isDeclarationOnlyFunctionNode(
  node: TSESTree.Node,
): node is TSESTree.TSDeclareFunction | TSESTree.TSEmptyBodyFunctionExpression {
  return (
    node.type === AST_NODE_TYPES.TSDeclareFunction ||
    node.type === AST_NODE_TYPES.TSEmptyBodyFunctionExpression
  );
}

const PARAMETER_WRAPPER_TYPES: ReadonlySet<string> = new Set([
  AST_NODE_TYPES.ArrayPattern,
  AST_NODE_TYPES.ObjectPattern,
  AST_NODE_TYPES.Property,
  AST_NODE_TYPES.RestElement,
  AST_NODE_TYPES.TSParameterProperty,
]);

function isFunctionParameterDefault(node: TSESTree.AssignmentPattern): boolean {
  let current: TSESTree.Node = node;
  while (current.parent !== undefined) {
    const parent: TSESTree.Node = current.parent;
    if (isFunctionNode(parent)) {
      return functionOwnsNode(parent, current);
    }
    if (!PARAMETER_WRAPPER_TYPES.has(parent.type)) {
      return false;
    }
    current = parent;
  }
  return false;
}

function functionOwnsNode(parent: TSESTree.FunctionLike, node: TSESTree.Node): boolean {
  return parent.params.some((parameter) => parameter === node);
}

function isDirectFunctionParameter(node: TSESTree.Node): boolean {
  const parent = node.parent;
  return parent !== undefined && isFunctionNode(parent) && functionOwnsNode(parent, node);
}

function isObjectParameterPattern(node: TSESTree.ObjectPattern): boolean {
  if (isDirectFunctionParameter(node)) {
    return true;
  }
  const parent = node.parent;
  return (
    parent.type === AST_NODE_TYPES.AssignmentPattern &&
    parent.left === node &&
    isDirectFunctionParameter(parent)
  );
}

function nestedPattern(node: TSESTree.Node): boolean {
  return node.type === AST_NODE_TYPES.ArrayPattern || node.type === AST_NODE_TYPES.ObjectPattern;
}

function reportUnsafeObjectParameter(
  context: Readonly<{
    report(descriptor: {
      messageId: "computedDestructuring" | "nestedDestructuring";
      node: TSESTree.Node;
    }): void;
  }>,
  node: TSESTree.ObjectPattern,
): void {
  if (!isObjectParameterPattern(node)) {
    return;
  }
  for (const property of node.properties) {
    if (property.type !== AST_NODE_TYPES.Property) {
      continue;
    }
    if (nestedPattern(property.value)) {
      context.report({ node: property.value, messageId: "nestedDestructuring" });
      continue;
    }
    if (
      property.computed ||
      property.key.type !== AST_NODE_TYPES.Identifier ||
      !property.shorthand
    ) {
      context.report({ node: property.key, messageId: "computedDestructuring" });
    }
  }
}

function hasEmptyDestructuringDefault(node: TSESTree.AssignmentPattern): boolean {
  if (node.left.type === AST_NODE_TYPES.ObjectPattern) {
    return (
      node.right.type === AST_NODE_TYPES.ObjectExpression && node.right.properties.length === 0
    );
  }
  if (node.left.type === AST_NODE_TYPES.ArrayPattern) {
    return node.right.type === AST_NODE_TYPES.ArrayExpression && node.right.elements.length === 0;
  }
  return true;
}

/**
 * Rejects side effects and non-empty fallback values in default parameters.
 */
export const noUnsafeParameterDefaults = createRule({
  name: "no-unsafe-parameter-defaults",
  meta: {
    type: "problem",
    docs: {
      description:
        "Default parameters execute at call time; pure empty destructuring defaults keep omitted arguments predictable.",
      url: PRINCIPLE_URL.TYPES_BEAT_TESTS,
    },
    messages: {
      computedDestructuring:
        "Object parameter destructuring must use unquoted, non-computed property names.",
      destructuringDefault:
        "Optional destructured parameters must default to an empty object or array; put member defaults on the left-hand side.",
      nestedDestructuring:
        "Keep object parameter destructuring to one level; move nested extraction into the function body.",
      sideEffect:
        "Default parameter initializers must not call, construct, mutate, await, yield, or read a potentially effectful property.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      AssignmentPattern(node) {
        if (!isFunctionParameterDefault(node)) {
          return;
        }
        if (!hasEmptyDestructuringDefault(node)) {
          context.report({ node: node.right, messageId: "destructuringDefault" });
          return;
        }
        if (isPureDefault(node.right)) {
          return;
        }
        context.report({ node: node.right, messageId: "sideEffect" });
      },
      ObjectPattern(node) {
        reportUnsafeObjectParameter(context, node);
      },
    };
  },
});
