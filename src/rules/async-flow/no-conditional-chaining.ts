import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

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
        "Flag optional or nullable function parameters passed onward before the function resolves the conditional shape.",
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
    function checkFunction(node: FunctionNode): void {
      if (isBoundaryNormalizer(node)) return;
      for (const parameter of node.params) {
        const name = unresolvedParameterName(parameter);
        if (name === null) continue;
        context.report({
          node: parameter,
          messageId: "conditionalChaining",
          data: { name },
        });
      }
    }

    return {
      ArrowFunctionExpression: checkFunction,
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
    };
  },
});

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
  for (const property of parameter.properties) {
    const name = objectPatternPropertyName(property);
    if (name === null) continue;
    if (typeLiteralPropertyIsUnresolved(shape, name)) return name;
  }
  return null;
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
  for (const member of typeLiteral.members) {
    if (
      member.type === AST_NODE_TYPES.TSPropertySignature &&
      propertySignatureName(member) === name
    ) {
      return member.optional || propertySignatureIsNullable(member);
    }
  }
  return false;
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
  if (node.type === AST_NODE_TYPES.TSUndefinedKeyword ||
    node.type === AST_NODE_TYPES.TSNullKeyword) {
    return true;
  }
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
  if (expressionName !== null) return expressionName;
  return parentVariableDeclaratorName(node);
}

function namedFunctionExpressionName(node: FunctionNode): string | null {
  return node.type === AST_NODE_TYPES.FunctionExpression && node.id
    ? node.id.name
    : null;
}

function parentVariableDeclaratorName(node: FunctionNode): string | null {
  const parent = parentOf(node);
  return parent?.type === AST_NODE_TYPES.VariableDeclarator &&
    parent.id.type === AST_NODE_TYPES.Identifier
    ? parent.id.name
    : null;
}

function parentOf(node: TSESTree.Node): TSESTree.Node | null {
  return (node as TSESTree.Node & { readonly parent?: TSESTree.Node }).parent ?? null;
}
