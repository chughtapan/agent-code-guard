/**
 * @file AST refinement utilities. Branded narrowers and helpers that
 * turn raw ESLint AST nodes into the strongly-typed shapes rule
 * implementations expect: known-static strings, parented nodes, static
 * member expressions, tag accesses, and the related extractor helpers.
 */

import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

type NonEmptyArray<T> = readonly [T, ...T[]];

// Per-brand key: each brand carries a unique property name so two brands
// can intersect without TypeScript collapsing the shared key to `never`.
// `StaticMemberExpression & TagAccess` composes correctly because the
// brand keys do not overlap.

/** A string value the analyzer has proven to be statically known. */
export type StaticString = string & { readonly __brand_StaticString: "StaticString" };

// The smart constructor stays module-private so callers cannot mint a
// `StaticString` without going through a narrower that has actually
// proven the value is static. Exported narrowers (`getStaticStringKey`,
// `resolveStringLiteralValue`, etc.) are the only legal factories.
const staticString = (value: string): StaticString => value as StaticString;

/** An AST node whose parent reference has been proven non-null. */
export type NodeWithParent = TSESTree.Node & {
  readonly parent: TSESTree.Node;
} & { readonly __brand_NodeWithParent: "NodeWithParent" };

/** A non-computed member expression with an `Identifier` property. */
export type StaticMemberExpression = TSESTree.MemberExpression & {
  readonly computed: false;
  readonly property: TSESTree.Identifier;
} & { readonly __brand_StaticMemberExpression: "StaticMemberExpression" };

/** A static member expression whose property name is `_tag`. */
export type TagAccess = StaticMemberExpression & {
  readonly property: TSESTree.Identifier & { readonly name: "_tag" };
} & { readonly __brand_TagAccess: "TagAccess" };

/**
 * First element of `values`, or `null` when the array is empty.
 * @param values Array of values to inspect.
 * @returns The first element, or `null` if there is none.
 */
export function getFirst<T>(values: readonly T[]): T | null {
  const [first] = values;
  return first ?? null;
}

/**
 * Parent of `node`, branded as `NodeWithParent` when present.
 * @param node AST node to read the parent of.
 * @returns The parent node branded as non-null, or `null` for roots.
 */
export function getParent(node: TSESTree.Node): NodeWithParent | null {
  return node.parent ? (node.parent as NodeWithParent) : null;
}

/**
 * Extract a statically-known string from an object key or template
 * literal. Handles non-computed identifiers, string literals, and
 * empty-expression template literals.
 * @param key The property key AST node to read.
 * @param computed Whether the key is in a computed position.
 * @returns The branded static string, or `null` if `key` is dynamic.
 */
export function getStaticStringKey(
  key: TSESTree.Expression | TSESTree.PrivateIdentifier,
  computed: boolean,
): StaticString | null {
  if (!computed && key.type === AST_NODE_TYPES.Identifier) {
    return staticString(key.name);
  }
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === "string") {
    return staticString(key.value);
  }
  return computed && key.type === AST_NODE_TYPES.TemplateLiteral
    ? getStaticTemplateValue(key)
    : null;
}

/**
 * Resolve a string-literal or empty-expression template-literal node
 * into its static string value.
 * @param node The AST node to inspect; may be `null`.
 * @returns The branded static string, or `null` if `node` is not a
 * recognized literal form.
 */
export function resolveStringLiteralValue(
  node: TSESTree.Node | null,
): StaticString | null {
  if (node?.type === AST_NODE_TYPES.Literal && typeof node.value === "string") {
    return staticString(node.value);
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
  return head === null ? null : staticString(head.value.cooked ?? head.value.raw);
}

/**
 * Resolve a numeric-literal node (including unary-minus prefixed ones)
 * into its number value.
 * @param node The AST node to inspect.
 * @returns The number value, or `null` if `node` is not a numeric
 * literal.
 */
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

/**
 * Narrow a node to a static (non-computed, identifier-property) member
 * expression, unwrapping optional-chaining wrappers when present.
 * @param node The AST node to inspect.
 * @returns The branded static member expression, or `null` if `node`
 * is dynamic or not a member expression.
 */
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

/**
 * Static property name of a member expression, if `node` is a static
 * member expression.
 * @param node The AST node to inspect.
 * @returns The branded property name, or `null` when `node` is dynamic.
 */
export function getStaticMemberPropertyName(
  node: TSESTree.Node,
): StaticString | null {
  const member = getStaticMemberExpression(node);
  return member ? staticString(member.property.name) : null;
}

/**
 * Narrow a node to a `_tag` member access (e.g. `value._tag`).
 * @param node The AST node to inspect.
 * @returns The branded tag access, or `null` if `node` is not a static
 * member expression with a `_tag` property.
 */
export function getTagAccess(node: TSESTree.Node): TagAccess | null {
  const member = getStaticMemberExpression(node);
  if (member === null || member.property.name !== "_tag") return null;
  return member as TagAccess;
}

/**
 * Whether `node` is a static call of the form `objectName.propertyName(...)`.
 * @param node The call expression to inspect.
 * @param objectName Expected receiver identifier name.
 * @param propertyName Expected property name on the receiver.
 * @returns `true` when both names match the static callee.
 */
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

/**
 * Walk up the AST from `node` and return the name of the nearest
 * enclosing function (function declaration, variable-assigned arrow,
 * or named property carrier).
 * @param node The AST node to start the walk from.
 * @returns The branded function name, or `null` if no named enclosing
 * function is found.
 */
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
    return node.id ? staticString(node.id.name) : null;
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
    ? staticString(node.id.name)
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

/**
 * Whether `node` sits directly inside a function's return-type
 * annotation (as opposed to a parameter type, variable annotation,
 * etc.).
 * @param node The TS type reference to inspect.
 * @returns `true` when `node` is the function's declared return type.
 */
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
