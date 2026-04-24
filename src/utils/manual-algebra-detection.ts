import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { getStaticStringKey, getStringLiteralValue } from "./ast-refinement.js";

export type ManualAlgebraKind = "result" | "option" | "brand";

export interface ManualAlgebraMatch {
  readonly kind: ManualAlgebraKind;
  readonly displayName: string;
  readonly messageId: "manualResult" | "manualOption" | "manualBrand";
  readonly node: TSESTree.Node;
}

type SurfaceKind = "type" | "interface" | "class" | "object" | "function";

interface Surface {
  readonly kind: SurfaceKind;
  readonly node: TSESTree.Node;
  readonly displayName: string | null;
  readonly keys: ReadonlySet<string>;
  readonly stringLiterals: ReadonlySet<string>;
  readonly booleanLiterals: ReadonlySet<"true" | "false">;
  readonly hasTagKey: boolean;
}

const TRANSPORT_NAME_RE =
  /(Request|Response|Payload|Dto|DTO|Event|State|Config|Schema|Record|Snapshot|Params|Props|Options|Row|Json|JSON)$/;
const ERROR_NAME_RE = /(^err(or)?$|Error$|Failure$|Failed$|Exception$)/i;
const RESULT_NAME_RE = /(Result|Either|Outcome|Try)$/;
const OPTION_NAME_RE = /(Option|Maybe)$/;
const BRAND_HELPER_RE = /^(as|make|to)[A-Z]/;

const RESULT_LITERAL_PAIRS = [
  ["ok", "err"],
  ["ok", "error"],
  ["success", "failure"],
  ["left", "right"],
] as const;

const OPTION_LITERAL_PAIRS = [
  ["some", "none"],
  ["present", "absent"],
] as const;

const RESULT_HELPERS = new Set([
  "match",
  "map",
  "maperror",
  "flatmap",
  "andthen",
  "fold",
  "unwrapor",
  "isok",
  "iserr",
  "isleft",
  "isright",
  "issuccess",
  "isfailure",
]);

const OPTION_HELPERS = new Set([
  "match",
  "map",
  "flatmap",
  "fold",
  "getorelse",
  "unwrapor",
  "issome",
  "isnone",
  "hasvalue",
]);

const BRAND_MARKERS = new Set(["__brand", "_brand"]);
const SOME_OPTION_NAMES = new Set(["some", "present"]);
const NONE_OPTION_NAMES = new Set(["none", "absent"]);
const SOME_RESULT_NAMES = new Set(["left", "right", "success", "failure"]);
const TRANSPORT_HELPERS = new Set([...RESULT_HELPERS, ...OPTION_HELPERS]);
const RESULT_FUNCTION_NAMES = new Set([
  "ok",
  "err",
  "error",
  "left",
  "right",
  "success",
  "failure",
  ...RESULT_HELPERS,
]);
const OPTION_FUNCTION_NAMES = new Set([
  "some",
  "none",
  "present",
  "absent",
  ...OPTION_HELPERS,
]);

function createSurface(
  kind: SurfaceKind,
  node: TSESTree.Node,
  displayName: string | null,
): {
  kind: SurfaceKind;
  node: TSESTree.Node;
  displayName: string | null;
  keys: Set<string>;
  stringLiterals: Set<string>;
  booleanLiterals: Set<"true" | "false">;
  hasTagKey: boolean;
} {
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

function finalizeSurface(
  surface: ReturnType<typeof createSurface>,
): Surface {
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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function hasNormalized(
  values: ReadonlySet<string>,
  candidates: Iterable<string>,
): boolean {
  const normalized = new Set([...values].map(normalize));
  for (const candidate of candidates) {
    if (normalized.has(normalize(candidate))) return true;
  }
  return false;
}

function hasLiteralPair(
  surface: Surface,
  left: string,
  right: string,
): boolean {
  return hasNormalized(surface.stringLiterals, [left]) &&
    hasNormalized(surface.stringLiterals, [right]);
}

function hasKeyPair(
  surface: Surface,
  left: string,
  right: string,
): boolean {
  return hasNormalized(surface.keys, [left]) &&
    hasNormalized(surface.keys, [right]);
}

function addKey(
  surface: ReturnType<typeof createSurface>,
  key: TSESTree.Expression | TSESTree.PrivateIdentifier,
  computed: boolean,
): void {
  const name = getStaticStringKey(key, computed);
  if (name === null) return;
  surface.keys.add(name);
  if (name === "_tag") surface.hasTagKey = true;
}

function addLiteral(
  surface: ReturnType<typeof createSurface>,
  node: TSESTree.Node | null,
): void {
  const literal = getStringLiteralValue(node);
  if (literal !== null) {
    surface.stringLiterals.add(literal);
    return;
  }
  if (node?.type === AST_NODE_TYPES.Literal && typeof node.value === "boolean") {
    surface.booleanLiterals.add(node.value ? "true" : "false");
  }
}

function addTypeLiterals(
  surface: ReturnType<typeof createSurface>,
  node: TSESTree.TypeNode,
): void {
  if (node.type === AST_NODE_TYPES.TSLiteralType) {
    addLiteral(surface, node.literal);
    return;
  }
  if (node.type === AST_NODE_TYPES.TSUnionType) {
    for (const type of node.types) addTypeLiterals(surface, type);
  }
}

function addTypeElement(
  surface: ReturnType<typeof createSurface>,
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
  surface: ReturnType<typeof createSurface>,
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
  surface: ReturnType<typeof createSurface>,
  member: TSESTree.ClassElement,
): void {
  if (member.type === AST_NODE_TYPES.PropertyDefinition) {
    addKey(surface, member.key, member.computed);
    addLiteral(surface, member.value);
    return;
  }
  if (member.type === AST_NODE_TYPES.MethodDefinition) {
    addKey(surface, member.key, member.computed);
  }
}

function addObjectMember(
  surface: ReturnType<typeof createSurface>,
  member: TSESTree.ObjectLiteralElement,
): void {
  if (member.type !== AST_NODE_TYPES.Property) return;
  addKey(surface, member.key, member.computed);
  addLiteral(surface, member.value);
}

function isNode(value: unknown): value is TSESTree.Node {
  return typeof value === "object" && value !== null && "type" in value;
}

function walkNode(
  node: TSESTree.Node | null,
  visit: (node: TSESTree.Node) => void,
): void {
  if (node === null) return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) {
      for (const child of value) {
        walkNode(isNode(child) ? child : null, visit);
      }
      continue;
    }
    walkNode(isNode(value) ? value : null, visit);
  }
}

function addFunctionBody(
  surface: ReturnType<typeof createSurface>,
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
): void {
  const body = node.body;
  walkNode(body, (child) => {
    if (child.type === AST_NODE_TYPES.Property) {
      addKey(surface, child.key, child.computed);
      addLiteral(surface, child.value);
      return;
    }
    if (child.type === AST_NODE_TYPES.MemberExpression) {
      addKey(surface, child.property, child.computed);
      return;
    }
    if (child.type === AST_NODE_TYPES.Literal) {
      addLiteral(surface, child);
    }
  });
}

function getPatternName(pattern: TSESTree.VariableDeclarator["id"]): string | null {
  return pattern.type === AST_NODE_TYPES.Identifier ? pattern.name : null;
}

function surfaceFromNode(node: TSESTree.Node): Surface | null {
  switch (node.type) {
    case AST_NODE_TYPES.TSTypeAliasDeclaration: {
      const surface = createSurface("type", node, node.id.name);
      addTypeNode(surface, node.typeAnnotation);
      return finalizeSurface(surface);
    }
    case AST_NODE_TYPES.TSInterfaceDeclaration: {
      const surface = createSurface("interface", node, node.id.name);
      for (const member of node.body.body) addTypeElement(surface, member);
      return finalizeSurface(surface);
    }
    case AST_NODE_TYPES.ClassDeclaration:
    case AST_NODE_TYPES.ClassExpression: {
      const surface = createSurface(
        "class",
        node,
        node.id?.name ?? null,
      );
      for (const member of node.body.body) addClassMember(surface, member);
      return finalizeSurface(surface);
    }
    case AST_NODE_TYPES.FunctionDeclaration: {
      const surface = createSurface("function", node, node.id?.name ?? null);
      addFunctionBody(surface, node);
      return finalizeSurface(surface);
    }
    case AST_NODE_TYPES.VariableDeclarator: {
      const displayName = getPatternName(node.id);
      if (displayName === null) return null;
      const init = node.init;
      if (init === null) return null;
      if (init.type === AST_NODE_TYPES.ObjectExpression) {
        const surface = createSurface("object", node, displayName);
        for (const member of init.properties) addObjectMember(surface, member);
        return finalizeSurface(surface);
      }
      if (init.type === AST_NODE_TYPES.ClassExpression) {
        const surface = createSurface("class", node, displayName);
        for (const member of init.body.body) addClassMember(surface, member);
        return finalizeSurface(surface);
      }
      if (
        init.type === AST_NODE_TYPES.FunctionExpression ||
        init.type === AST_NODE_TYPES.ArrowFunctionExpression
      ) {
        const surface = createSurface("function", node, displayName);
        addFunctionBody(surface, init);
        return finalizeSurface(surface);
      }
      return null;
    }
    default:
      return null;
  }
}

function looksResultLikeName(name: string | null): boolean {
  return typeof name === "string" && RESULT_NAME_RE.test(name);
}

function looksOptionLikeName(name: string | null): boolean {
  return typeof name === "string" && OPTION_NAME_RE.test(name);
}

function isTransportLikeName(name: string | null): boolean {
  return typeof name === "string" && TRANSPORT_NAME_RE.test(name);
}

function looksErrorLike(value: string | null): boolean {
  return typeof value === "string" && ERROR_NAME_RE.test(value);
}

function hasDiscriminantStyle(surface: Surface): boolean {
  return surface.hasTagKey || hasNormalized(surface.keys, ["type", "kind", "status"]);
}

function hasResultBranchPair(surface: Surface): boolean {
  if (
    hasNormalized(surface.keys, ["ok"]) &&
    (hasNormalized(surface.keys, ["error", "err"]) ||
      hasNormalized(surface.keys, ["value"]))
  ) {
    return true;
  }
  return RESULT_LITERAL_PAIRS.some(([left, right]) =>
    hasKeyPair(surface, left, right) || hasLiteralPair(surface, left, right)
  );
}

function hasOptionBranchPair(surface: Surface): boolean {
  if (surface.hasTagKey && OPTION_LITERAL_PAIRS.some(([left, right]) => hasLiteralPair(surface, left, right))) {
    return true;
  }
  return OPTION_LITERAL_PAIRS.some(([left, right]) => hasKeyPair(surface, left, right));
}

function getNormalizedDisplayName(surface: Surface): string | null {
  return surface.displayName === null ? null : normalize(surface.displayName);
}

function hasNormalizedDisplayName(
  surface: Surface,
  candidates: ReadonlySet<string>,
): boolean {
  const name = getNormalizedDisplayName(surface);
  return name !== null && candidates.has(name);
}

function hasBooleanLiteral(
  surface: Surface,
  candidate: "true" | "false",
): boolean {
  return surface.booleanLiterals.has(candidate);
}

function hasTaggedLiterals(surface: Surface, candidates: Iterable<string>): boolean {
  return surface.hasTagKey && hasNormalized(surface.stringLiterals, candidates);
}

function hasKeys(surface: Surface, candidates: Iterable<string>): boolean {
  return hasNormalized(surface.keys, candidates);
}

function hasResultFunctionEvidence(surface: Surface): boolean {
  if (surface.kind !== "function") return hasResultBranchPair(surface);
  const name = getNormalizedDisplayName(surface);
  if (name === null) return false;
  if (name === "ok") {
    return hasKeys(surface, ["ok"]) &&
      (hasKeys(surface, ["value"]) || hasBooleanLiteral(surface, "true"));
  }
  if (name === "err" || name === "error") {
    return hasKeys(surface, ["error", "err"]) ||
      (hasKeys(surface, ["ok"]) && hasBooleanLiteral(surface, "false"));
  }
  if (SOME_RESULT_NAMES.has(name)) {
    return hasKeys(surface, [name]) || hasNormalized(surface.stringLiterals, [name]);
  }
  if (name === "isok") return hasKeys(surface, ["ok"]);
  if (name === "iserr") {
    return hasKeys(surface, ["error", "err"]) || hasBooleanLiteral(surface, "false");
  }
  if (name === "isleft" || name === "isright") {
    const branchName = name.slice(2);
    return hasKeys(surface, [branchName]) ||
      hasNormalized(surface.stringLiterals, [branchName]);
  }
  if (name === "issuccess" || name === "isfailure") {
    const branchName = name.slice(2);
    return hasKeys(surface, [branchName]) ||
      hasNormalized(surface.stringLiterals, [branchName]);
  }
  return hasResultBranchPair(surface);
}

function hasOptionFunctionEvidence(surface: Surface): boolean {
  if (surface.kind !== "function") return hasOptionBranchPair(surface);
  const name = getNormalizedDisplayName(surface);
  if (name === null) return false;
  const someLike = hasTaggedLiterals(surface, SOME_OPTION_NAMES) || hasKeys(surface, ["value"]);
  const noneLike = hasTaggedLiterals(surface, NONE_OPTION_NAMES) || hasKeys(surface, NONE_OPTION_NAMES);

  if (SOME_OPTION_NAMES.has(name)) return someLike;
  if (NONE_OPTION_NAMES.has(name)) return noneLike;
  if (name === "issome" || name === "hasvalue") return someLike;
  if (name === "isnone") return hasTaggedLiterals(surface, NONE_OPTION_NAMES);
  return hasOptionBranchPair(surface);
}

function hasResultReusableSignal(surface: Surface): boolean {
  return looksResultLikeName(surface.displayName) ||
    hasNormalizedDisplayName(surface, RESULT_FUNCTION_NAMES) ||
    hasNormalized(surface.keys, RESULT_HELPERS);
}

function hasOptionReusableSignal(surface: Surface): boolean {
  return looksOptionLikeName(surface.displayName) ||
    hasNormalizedDisplayName(surface, OPTION_FUNCTION_NAMES) ||
    hasNormalized(surface.keys, OPTION_HELPERS);
}

function hasBrandMarker(surface: Surface): boolean {
  return hasKeys(surface, BRAND_MARKERS) ||
    (surface.displayName !== null &&
      hasKeys(surface, ["brand"]) &&
      hasNormalized(surface.stringLiterals, [surface.displayName]));
}

function getBrandHelperCastName(node: TSESTree.Node): string | null {
  let expression: TSESTree.Expression | null = null;
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
    if (!node.returnType || !node.body) return null;
    expression = getSingleReturnedExpression(node.body.body);
  }
  if (
    node.type === AST_NODE_TYPES.VariableDeclarator &&
    node.init &&
    (node.init.type === AST_NODE_TYPES.FunctionExpression ||
      node.init.type === AST_NODE_TYPES.ArrowFunctionExpression)
  ) {
    const fn = node.init;
    if (!fn.returnType) return null;
    if (fn.body.type === AST_NODE_TYPES.BlockStatement) {
      expression = getSingleReturnedExpression(fn.body.body);
    } else {
      expression = fn.body;
    }
  }

  if (expression === null) return null;
  const unwrapped =
    expression.type === AST_NODE_TYPES.TSAsExpression ? expression : null;
  if (unwrapped === null) return null;
  const annotation = unwrapped.typeAnnotation;
  if (
    annotation.type !== AST_NODE_TYPES.TSTypeReference ||
    annotation.typeName.type !== AST_NODE_TYPES.Identifier
  ) {
    return null;
  }
  return annotation.typeName.name;
}

function getSingleReturnedExpression(
  statements: readonly TSESTree.Statement[],
): TSESTree.Expression | null {
  if (statements.length !== 1) return null;
  const statement = statements[0]!;
  if (statement.type !== AST_NODE_TYPES.ReturnStatement) return null;
  return statement.argument ?? null;
}

function matchesBrandHelperName(
  surface: Surface,
  targetType: string,
): boolean {
  const name = surface.displayName;
  return name !== null &&
    (name === targetType || BRAND_HELPER_RE.test(name));
}

function match(
  surface: Surface,
  kind: ManualAlgebraKind,
  messageId: ManualAlgebraMatch["messageId"],
): ManualAlgebraMatch {
  return {
    kind,
    messageId,
    node: surface.node,
    displayName: surface.displayName ?? "(anonymous)",
  };
}

function isTransportDataSurface(surface: Surface): boolean {
  const name = surface.displayName;
  if (isTransportLikeName(name)) return true;
  if (surface.kind === "function") return false;
  if (looksResultLikeName(name) || looksOptionLikeName(name)) return false;
  return hasDiscriminantStyle(surface) && !hasKeys(surface, TRANSPORT_HELPERS);
}

function isTaggedErrorSurface(surface: Surface): boolean {
  return surface.hasTagKey &&
    (looksErrorLike(surface.displayName) ||
      [...surface.stringLiterals].some((value) => looksErrorLike(value)));
}

function isExcludedSurface(surface: Surface): boolean {
  return isTransportDataSurface(surface) || isTaggedErrorSurface(surface);
}

export function isTransportDataShape(node: TSESTree.Node): boolean {
  const surface = surfaceFromNode(node);
  return surface === null ? false : isTransportDataSurface(surface);
}

export function isTaggedErrorCollision(node: TSESTree.Node): boolean {
  const surface = surfaceFromNode(node);
  return surface === null ? false : isTaggedErrorSurface(surface);
}

export function findManualResultMatch(
  node: TSESTree.Node,
): ManualAlgebraMatch | null {
  const surface = surfaceFromNode(node);
  if (surface === null) return null;
  if (isExcludedSurface(surface)) return null;
  if (!hasResultFunctionEvidence(surface)) return null;
  if (!hasResultReusableSignal(surface)) return null;
  return match(surface, "result", "manualResult");
}

export function findManualOptionMatch(
  node: TSESTree.Node,
): ManualAlgebraMatch | null {
  const surface = surfaceFromNode(node);
  if (surface === null) return null;
  if (isExcludedSurface(surface)) return null;
  if (!hasOptionFunctionEvidence(surface)) return null;
  if (!hasOptionReusableSignal(surface)) return null;
  return match(surface, "option", "manualOption");
}

export function findManualBrandMatch(
  node: TSESTree.Node,
): ManualAlgebraMatch | null {
  const surface = surfaceFromNode(node);
  if (surface === null) return null;
  if (isExcludedSurface(surface)) return null;
  if (hasBrandMarker(surface)) {
    return match(surface, "brand", "manualBrand");
  }

  const targetType = getBrandHelperCastName(node);
  if (targetType === null) return null;
  if (!matchesBrandHelperName(surface, targetType)) return null;
  return match(surface, "brand", "manualBrand");
}
