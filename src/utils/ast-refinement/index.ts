import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { Brand } from "effect";

type NonEmptyArray<T> = readonly [T, ...T[]];

export type StaticString = string & Brand.Brand<"StaticString">;
const StaticString = Brand.nominal<StaticString>();

export type NodeWithParent = TSESTree.Node & {
  readonly parent: TSESTree.Node;
} & Brand.Brand<"NodeWithParent">;

export type StaticMemberExpression = TSESTree.MemberExpression & {
  readonly computed: false;
  readonly property: TSESTree.Identifier;
} & Brand.Brand<"StaticMemberExpression">;

export type TagAccess = StaticMemberExpression & {
  readonly property: TSESTree.Identifier & { readonly name: "_tag" };
} & Brand.Brand<"TagAccess">;

export function getFirst<T>(values: readonly T[]): T | null {
  const [first] = values;
  return first ?? null;
}

export function getParent(node: TSESTree.Node): NodeWithParent | null {
  return node.parent ? (node.parent as NodeWithParent) : null;
}

export function getStaticStringKey(
  key: TSESTree.Expression | TSESTree.PrivateIdentifier,
  computed: boolean,
): StaticString | null {
  if (!computed && key.type === AST_NODE_TYPES.Identifier) {
    return StaticString(key.name);
  }
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === "string") {
    return StaticString(key.value);
  }
  return computed && key.type === AST_NODE_TYPES.TemplateLiteral
    ? getStaticTemplateValue(key)
    : null;
}

export function resolveStringLiteralValue(
  node: TSESTree.Node | null,
): StaticString | null {
  if (node?.type === AST_NODE_TYPES.Literal && typeof node.value === "string") {
    return StaticString(node.value);
  }
  return node?.type === AST_NODE_TYPES.TemplateLiteral
    ? getStaticTemplateValue(node)
    : null;
}

function getStaticTemplateValue(
  node: TSESTree.TemplateLiteral,
): StaticString | null {
  if (node.expressions.length > 0) return null;
  const head = getFirst(node.quasis);
  return head === null ? null : StaticString(head.value.cooked ?? head.value.raw);
}

export function getNumericLiteralValue(node: TSESTree.Node): number | null {
  if (node.type === AST_NODE_TYPES.Literal && typeof node.value === "number") {
    return node.value;
  }
  if (
    node.type === AST_NODE_TYPES.UnaryExpression &&
    node.operator === "-" &&
    node.argument.type === AST_NODE_TYPES.Literal &&
    typeof node.argument.value === "number"
  ) {
    return -node.argument.value;
  }
  return null;
}

export function getStaticMemberExpression(
  node: TSESTree.Node,
): StaticMemberExpression | null {
  const unwrapped =
    node.type === AST_NODE_TYPES.ChainExpression ? node.expression : node;
  if (unwrapped.type !== AST_NODE_TYPES.MemberExpression || unwrapped.computed) {
    return null;
  }
  if (unwrapped.property.type !== AST_NODE_TYPES.Identifier) return null;
  return unwrapped as StaticMemberExpression;
}

export function getStaticMemberPropertyName(
  node: TSESTree.Node,
): StaticString | null {
  const member = getStaticMemberExpression(node);
  return member ? StaticString(member.property.name) : null;
}

export function getTagAccess(node: TSESTree.Node): TagAccess | null {
  const member = getStaticMemberExpression(node);
  if (member === null || member.property.name !== "_tag") return null;
  return member as TagAccess;
}

export function isNamedMemberCall(
  node: TSESTree.CallExpression,
  objectName: string,
  propertyName: string,
): boolean {
  const callee = getStaticMemberExpression(node.callee);
  return (
    callee !== null &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === objectName &&
    callee.property.name === propertyName
  );
}

export function getEnclosingFunctionName(
  node: TSESTree.Node,
): StaticString | null {
  let current = getParent(node);
  while (current) {
    const name = getFunctionNameAtNode(current);
    if (name !== undefined) return name;
    current = getParent(current);
  }
  return null;
}

type FunctionNameLookup = StaticString | null | undefined;

function getFunctionNameAtNode(node: NodeWithParent): FunctionNameLookup {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
    return node.id ? StaticString(node.id.name) : null;
  }
  if (!isFunctionExpressionLike(node)) return undefined;
  const parent = getParent(node);
  return parent === null ? null : getFunctionNameFromParent(parent);
}

function isFunctionExpressionLike(
  node: TSESTree.Node,
): node is TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression {
  return node.type === AST_NODE_TYPES.FunctionExpression ||
    node.type === AST_NODE_TYPES.ArrowFunctionExpression;
}

function getFunctionNameFromParent(node: NodeWithParent): StaticString | null {
  if (node.type === AST_NODE_TYPES.VariableDeclarator) {
    return getVariableDeclaratorName(node);
  }
  return isPropertyNameCarrier(node) ? getPropertyCarrierName(node) : null;
}

function getVariableDeclaratorName(
  node: TSESTree.VariableDeclarator,
): StaticString | null {
  return node.id.type === AST_NODE_TYPES.Identifier
    ? StaticString(node.id.name)
    : null;
}

function isPropertyNameCarrier(
  node: TSESTree.Node,
): node is TSESTree.Property | TSESTree.MethodDefinition {
  return node.type === AST_NODE_TYPES.Property ||
    node.type === AST_NODE_TYPES.MethodDefinition;
}

function getPropertyCarrierName(
  node: TSESTree.Property | TSESTree.MethodDefinition,
): StaticString | null {
  return node.computed ? null : getStaticStringKey(node.key, node.computed);
}

type FunctionReturnTypeOwner =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | TSESTree.TSFunctionType
  | TSESTree.TSMethodSignature
  | TSESTree.TSDeclareFunction
  | TSESTree.TSEmptyBodyFunctionExpression;

const FUNCTION_RETURN_TYPE_OWNER_TYPES = new Set<string>([
  AST_NODE_TYPES.FunctionDeclaration,
  AST_NODE_TYPES.FunctionExpression,
  AST_NODE_TYPES.ArrowFunctionExpression,
  AST_NODE_TYPES.TSFunctionType,
  AST_NODE_TYPES.TSMethodSignature,
  AST_NODE_TYPES.TSDeclareFunction,
  AST_NODE_TYPES.TSEmptyBodyFunctionExpression,
]);

function isFunctionReturnTypeOwner(
  node: TSESTree.Node,
): node is FunctionReturnTypeOwner {
  return FUNCTION_RETURN_TYPE_OWNER_TYPES.has(node.type);
}

export function isFunctionReturnTypeReference(
  node: TSESTree.TSTypeReference,
): boolean {
  const annotation = getParent(node);
  if (annotation === null || annotation.type !== AST_NODE_TYPES.TSTypeAnnotation) {
    return false;
  }
  const owner = getParent(annotation);
  if (owner === null) return false;
  return isFunctionReturnTypeOwner(owner) && owner.returnType === annotation;
}
