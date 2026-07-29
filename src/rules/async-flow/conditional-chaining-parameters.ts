/**
 * @file Parameter-shape analysis for the no-conditional-chaining rule.
 */

import { type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";

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
  return parameter.optional || (annotation !== undefined && typeAnnotationIsNullable(annotation));
}

function objectPatternUnresolvedName(parameter: TSESTree.ObjectPattern): string | null {
  const shape = parameter.typeAnnotation?.typeAnnotation;
  if (shape?.type !== AST_NODE_TYPES.TSTypeLiteral) {
    return null;
  }
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
  if (name === null) {
    return null;
  }
  return typeLiteralPropertyIsUnresolved(shape, name) ? name : null;
}

function objectPatternPropertyName(
  property: TSESTree.ObjectPattern["properties"][number],
): string | null {
  if (property.type !== AST_NODE_TYPES.Property) {
    return null;
  }
  if (property.value.type === AST_NODE_TYPES.Identifier) {
    return property.value.name;
  }
  return staticPropertyName(property.key);
}

function typeLiteralPropertyIsUnresolved(
  typeLiteral: TSESTree.TSTypeLiteral,
  name: string,
): boolean {
  const member = typeLiteral.members.find((candidate) => isPropertySignatureNamed(candidate, name));
  if (member === undefined) {
    return false;
  }
  return member.optional || propertySignatureIsNullable(member);
}

function isPropertySignatureNamed(
  member: TSESTree.TypeElement,
  name: string,
): member is TSESTree.TSPropertySignature {
  return (
    member.type === AST_NODE_TYPES.TSPropertySignature && propertySignatureName(member) === name
  );
}

function propertySignatureIsNullable(member: TSESTree.TSPropertySignature): boolean {
  const annotation = member.typeAnnotation?.typeAnnotation;
  return annotation !== undefined && typeAnnotationIsNullable(annotation);
}

function propertySignatureName(member: TSESTree.TSPropertySignature): string | null {
  return staticPropertyName(member.key);
}

function staticPropertyName(node: TSESTree.Node): string | null {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  if (node.type !== AST_NODE_TYPES.Literal) {
    return null;
  }
  return typeof node.value === "string" ? node.value : null;
}

function typeAnnotationIsNullable(node: TSESTree.TypeNode): boolean {
  if (node.type === AST_NODE_TYPES.TSUndefinedKeyword) {
    return true;
  }
  if (node.type === AST_NODE_TYPES.TSNullKeyword) {
    return true;
  }
  return node.type === AST_NODE_TYPES.TSUnionType && node.types.some(typeAnnotationIsNullable);
}

/**
 * Finds an optional or nullable parameter with the requested local name.
 * @param params The enclosing function parameters.
 * @param name The argument identifier being forwarded.
 * @returns The unresolved parameter, or `null`.
 */
export function unresolvedParameter(
  params: readonly TSESTree.Parameter[],
  name: string,
): TSESTree.Parameter | null {
  return params.find((parameter) => unresolvedParameterName(parameter) === name) ?? null;
}
