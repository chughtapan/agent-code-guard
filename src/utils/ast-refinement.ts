import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { Brand } from "effect";

export type NonEmptyArray<T> = readonly [T, ...T[]];

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
  if (
    computed &&
    key.type === AST_NODE_TYPES.TemplateLiteral &&
    key.expressions.length === 0
  ) {
    const head = getFirst(key.quasis);
    if (head === null) return null;
    return StaticString(head.value.cooked ?? head.value.raw);
  }
  return null;
}

export function getStringLiteralValue(
  node: TSESTree.Node | null,
): StaticString | null {
  if (node?.type === AST_NODE_TYPES.Literal && typeof node.value === "string") {
    return StaticString(node.value);
  }
  if (
    node?.type === AST_NODE_TYPES.TemplateLiteral &&
    node.expressions.length === 0
  ) {
    const head = getFirst(node.quasis);
    if (head === null) return null;
    return StaticString(head.value.cooked ?? head.value.raw);
  }
  return null;
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
    switch (current.type) {
      case AST_NODE_TYPES.FunctionDeclaration:
        return current.id ? StaticString(current.id.name) : null;
      case AST_NODE_TYPES.FunctionExpression:
      case AST_NODE_TYPES.ArrowFunctionExpression: {
        const parent = getParent(current);
        if (parent === null) return null;
        switch (parent.type) {
          case AST_NODE_TYPES.VariableDeclarator:
            return parent.id.type === AST_NODE_TYPES.Identifier
              ? StaticString(parent.id.name)
              : null;
          case AST_NODE_TYPES.Property:
          case AST_NODE_TYPES.MethodDefinition:
            if (parent.computed) return null;
            return getStaticStringKey(parent.key, parent.computed);
          default:
            return null;
        }
      }
      default:
        current = getParent(current);
    }
  }
  return null;
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

  switch (owner.type) {
    case AST_NODE_TYPES.FunctionDeclaration:
    case AST_NODE_TYPES.FunctionExpression:
    case AST_NODE_TYPES.ArrowFunctionExpression:
    case AST_NODE_TYPES.TSFunctionType:
    case AST_NODE_TYPES.TSMethodSignature:
    case AST_NODE_TYPES.TSDeclareFunction:
    case AST_NODE_TYPES.TSEmptyBodyFunctionExpression:
      return owner.returnType === annotation;
    default:
      return false;
  }
}
