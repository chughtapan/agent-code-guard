import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { getStaticStringKey, resolveStringLiteralValue } from "./ast-refinement/index.js";

type SurfaceKind = "type" | "interface" | "class" | "object" | "function";

export interface Surface {
  readonly kind: SurfaceKind;
  readonly node: TSESTree.Node;
  readonly displayName: string | null;
  readonly keys: ReadonlySet<string>;
  readonly stringLiterals: ReadonlySet<string>;
  readonly booleanLiterals: ReadonlySet<"true" | "false">;
  readonly hasTagKey: boolean;
}

interface MutableSurface {
  kind: SurfaceKind;
  node: TSESTree.Node;
  displayName: string | null;
  keys: Set<string>;
  stringLiterals: Set<string>;
  booleanLiterals: Set<"true" | "false">;
  hasTagKey: boolean;
}

function fromSurfaceParts(
  kind: SurfaceKind,
  node: TSESTree.Node,
  displayName: string | null,
): MutableSurface {
  return {
    kind,
    node,
    displayName,
    keys: new Set<string>(),
    stringLiterals: new Set<string>(),
    booleanLiterals: new Set<"true" | "false">(),
    hasTagKey: false,
  };
}

function finalizeSurface(surface: MutableSurface): Surface {
  return {
    kind: surface.kind,
    node: surface.node,
    displayName: surface.displayName,
    keys: surface.keys,
    stringLiterals: surface.stringLiterals,
    booleanLiterals: surface.booleanLiterals,
    hasTagKey: surface.hasTagKey,
  };
}

export function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function hasNormalized(
  values: ReadonlySet<string>,
  candidates: Iterable<string>,
): boolean {
  const normalized = new Set([...values].map(normalize));
  for (const candidate of candidates) {
    if (normalized.has(normalize(candidate))) return true;
  }
  return false;
}

export function hasLiteralPair(
  surface: Surface,
  left: string,
  right: string,
): boolean {
  return hasNormalized(surface.stringLiterals, [left]) &&
    hasNormalized(surface.stringLiterals, [right]);
}

export function hasKeyPair(
  surface: Surface,
  left: string,
  right: string,
): boolean {
  return hasNormalized(surface.keys, [left]) &&
    hasNormalized(surface.keys, [right]);
}

function addKey(
  surface: MutableSurface,
  key: TSESTree.Expression | TSESTree.PrivateIdentifier,
  computed: boolean,
): void {
  const name = getStaticStringKey(key, computed);
  if (name === null) return;
  surface.keys.add(name);
  if (name === "_tag") surface.hasTagKey = true;
}

function resolveLiteralIntoSurface(
  surface: MutableSurface,
  node: TSESTree.Node | null,
): void {
  const literal = resolveStringLiteralValue(node);
  if (literal !== null) {
    surface.stringLiterals.add(literal);
    return;
  }
  if (node?.type === AST_NODE_TYPES.Literal && typeof node.value === "boolean") {
    surface.booleanLiterals.add(node.value ? "true" : "false");
  }
}

function addTypeLiterals(
  surface: MutableSurface,
  node: TSESTree.TypeNode,
): void {
  if (node.type === AST_NODE_TYPES.TSLiteralType) {
    resolveLiteralIntoSurface(surface, node.literal);
    return;
  }
  if (node.type === AST_NODE_TYPES.TSUnionType) {
    for (const type of node.types) addTypeLiterals(surface, type);
  }
}

function addTypeElement(
  surface: MutableSurface,
  member: TSESTree.TypeElement,
): void {
  if (member.type === AST_NODE_TYPES.TSPropertySignature) {
    addKey(surface, member.key, member.computed);
    if (member.typeAnnotation) {
      addTypeLiterals(surface, member.typeAnnotation.typeAnnotation);
    }
    return;
  }
  if (member.type === AST_NODE_TYPES.TSMethodSignature) {
    addKey(surface, member.key, member.computed);
  }
}

function addTypeNode(
  surface: MutableSurface,
  node: TSESTree.TypeNode,
): void {
  if (node.type === AST_NODE_TYPES.TSTypeLiteral) {
    for (const member of node.members) addTypeElement(surface, member);
    return;
  }
  if (
    node.type === AST_NODE_TYPES.TSUnionType ||
    node.type === AST_NODE_TYPES.TSIntersectionType
  ) {
    for (const type of node.types) addTypeNode(surface, type);
  }
}

function addClassMember(
  surface: MutableSurface,
  member: TSESTree.ClassElement,
): void {
  if (member.type === AST_NODE_TYPES.PropertyDefinition) {
    addKey(surface, member.key, member.computed);
    resolveLiteralIntoSurface(surface, member.value);
    return;
  }
  if (member.type === AST_NODE_TYPES.MethodDefinition) {
    addKey(surface, member.key, member.computed);
  }
}

function addObjectMember(
  surface: MutableSurface,
  member: TSESTree.ObjectLiteralElement,
): void {
  if (member.type !== AST_NODE_TYPES.Property) return;
  addKey(surface, member.key, member.computed);
  resolveLiteralIntoSurface(surface, member.value);
}

function isNode(value: unknown): value is TSESTree.Node {
  return typeof value === "object" && value !== null && "type" in value;
}

function walkNodeValue(
  value: unknown,
  visit: (node: TSESTree.Node) => void,
): void {
  if (Array.isArray(value)) {
    for (const child of value) walkNodeValue(child, visit);
    return;
  }
  if (isNode(value)) resolveNodeWalk(value, visit);
}

function resolveNodeWalk(
  node: TSESTree.Node | null,
  visit: (node: TSESTree.Node) => void,
): void {
  if (node === null) return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key !== "parent") walkNodeValue(value, visit);
  }
}

function addFunctionBody(
  surface: MutableSurface,
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): void {
  resolveNodeWalk(node.body, (child) => {
    if (child.type === AST_NODE_TYPES.Property) {
      addKey(surface, child.key, child.computed);
      resolveLiteralIntoSurface(surface, child.value);
      return;
    }
    if (child.type === AST_NODE_TYPES.MemberExpression) {
      addKey(surface, child.property, child.computed);
      return;
    }
    if (child.type === AST_NODE_TYPES.Literal) resolveLiteralIntoSurface(surface, child);
  });
}

function getPatternName(pattern: TSESTree.VariableDeclarator["id"]): string | null {
  return pattern.type === AST_NODE_TYPES.Identifier ? pattern.name : null;
}

function typeAliasSurface(node: TSESTree.TSTypeAliasDeclaration): Surface {
  const surface = fromSurfaceParts("type", node, node.id.name);
  addTypeNode(surface, node.typeAnnotation);
  return finalizeSurface(surface);
}

function interfaceSurface(node: TSESTree.TSInterfaceDeclaration): Surface {
  const surface = fromSurfaceParts("interface", node, node.id.name);
  for (const member of node.body.body) addTypeElement(surface, member);
  return finalizeSurface(surface);
}

function fromClassSurface(
  node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
  displayName: string | null,
): Surface {
  const surface = fromSurfaceParts("class", node, displayName);
  for (const member of node.body.body) addClassMember(surface, member);
  return finalizeSurface(surface);
}

function fromFunctionSurface(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
  displayName: string | null,
): Surface {
  const surface = fromSurfaceParts("function", node, displayName);
  addFunctionBody(surface, node);
  return finalizeSurface(surface);
}

function objectSurface(
  node: TSESTree.VariableDeclarator,
  displayName: string,
  init: TSESTree.ObjectExpression,
): Surface {
  const surface = fromSurfaceParts("object", node, displayName);
  for (const member of init.properties) addObjectMember(surface, member);
  return finalizeSurface(surface);
}

function variableSurface(node: TSESTree.VariableDeclarator): Surface | null {
  const displayName = getPatternName(node.id);
  if (displayName === null || node.init === null) return null;
  if (node.init.type === AST_NODE_TYPES.ObjectExpression) {
    return objectSurface(node, displayName, node.init);
  }
  if (node.init.type === AST_NODE_TYPES.ClassExpression) {
    return fromClassSurface(node.init, displayName);
  }
  if (
    node.init.type === AST_NODE_TYPES.FunctionExpression ||
    node.init.type === AST_NODE_TYPES.ArrowFunctionExpression
  ) {
    return fromFunctionSurface(node.init, displayName);
  }
  return null;
}

const SURFACE_READERS = new Map<string, (node: TSESTree.Node) => Surface | null>([
  [AST_NODE_TYPES.TSTypeAliasDeclaration, (node) =>
    typeAliasSurface(node as TSESTree.TSTypeAliasDeclaration)],
  [AST_NODE_TYPES.TSInterfaceDeclaration, (node) =>
    interfaceSurface(node as TSESTree.TSInterfaceDeclaration)],
  [AST_NODE_TYPES.ClassDeclaration, (node) => {
    const classNode = node as TSESTree.ClassDeclaration;
    return fromClassSurface(classNode, classNode.id?.name ?? null);
  }],
  [AST_NODE_TYPES.ClassExpression, (node) => {
    const classNode = node as TSESTree.ClassExpression;
    return fromClassSurface(classNode, classNode.id?.name ?? null);
  }],
  [AST_NODE_TYPES.FunctionDeclaration, (node) => {
    const functionNode = node as TSESTree.FunctionDeclaration;
    return fromFunctionSurface(functionNode, functionNode.id?.name ?? null);
  }],
  [AST_NODE_TYPES.VariableDeclarator, (node) =>
    variableSurface(node as TSESTree.VariableDeclarator)],
]);

export function surfaceFromNode(node: TSESTree.Node): Surface | null {
  return SURFACE_READERS.get(node.type)?.(node) ?? null;
}
