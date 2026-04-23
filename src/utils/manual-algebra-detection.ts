import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { getStaticStringKey, getStringLiteralValue } from "./ast-refinement.js";

export type ManualAlgebraKind = "result" | "option" | "brand";

export interface ManualAlgebraMatch {
  readonly kind: ManualAlgebraKind;
  readonly displayName: string;
  readonly messageId: "manualResult" | "manualOption" | "manualBrand";
  readonly node: TSESTree.Node;
  readonly evidence: readonly string[];
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
  switch (node.type) {
    case AST_NODE_TYPES.TSLiteralType:
      addLiteral(surface, node.literal);
      return;
    case AST_NODE_TYPES.TSUnionType:
      for (const type of node.types) addTypeLiterals(surface, type);
      return;
    default:
      return;
  }
}

function addTypeElement(
  surface: ReturnType<typeof createSurface>,
  member: TSESTree.TypeElement,
): void {
  switch (member.type) {
    case AST_NODE_TYPES.TSPropertySignature:
      addKey(surface, member.key, member.computed);
      if (member.typeAnnotation) {
        addTypeLiterals(surface, member.typeAnnotation.typeAnnotation);
      }
      return;
    case AST_NODE_TYPES.TSMethodSignature:
      addKey(surface, member.key, member.computed);
      return;
    default:
      return;
  }
}

function addTypeNode(
  surface: ReturnType<typeof createSurface>,
  node: TSESTree.TypeNode,
): void {
  switch (node.type) {
    case AST_NODE_TYPES.TSTypeLiteral:
      for (const member of node.members) addTypeElement(surface, member);
      return;
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType:
      for (const type of node.types) addTypeNode(surface, type);
      return;
    default:
      return;
  }
}

function addClassMember(
  surface: ReturnType<typeof createSurface>,
  member: TSESTree.ClassElement,
): void {
  switch (member.type) {
    case AST_NODE_TYPES.PropertyDefinition:
      addKey(surface, member.key, member.computed);
      addLiteral(surface, member.value);
      return;
    case AST_NODE_TYPES.MethodDefinition:
      addKey(surface, member.key, member.computed);
      return;
    default:
      return;
  }
}

function addObjectMember(
  surface: ReturnType<typeof createSurface>,
  member: TSESTree.ObjectLiteralElement,
): void {
  if (member.type !== AST_NODE_TYPES.Property) return;
  addKey(surface, member.key, member.computed);
  if (!member.method) addLiteral(surface, member.value);
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
      return finalizeSurface(createSurface("function", node, node.id?.name ?? null));
    }
    case AST_NODE_TYPES.VariableDeclarator: {
      const displayName = getPatternName(node.id);
      if (displayName === null || node.init === null) return null;
      switch (node.init.type) {
        case AST_NODE_TYPES.ObjectExpression: {
          const surface = createSurface("object", node, displayName);
          for (const member of node.init.properties) addObjectMember(surface, member);
          return finalizeSurface(surface);
        }
        case AST_NODE_TYPES.ClassExpression: {
          const surface = createSurface("class", node, displayName);
          for (const member of node.init.body.body) addClassMember(surface, member);
          return finalizeSurface(surface);
        }
        case AST_NODE_TYPES.FunctionExpression:
        case AST_NODE_TYPES.ArrowFunctionExpression:
          return finalizeSurface(createSurface("function", node, displayName));
        default:
          return null;
      }
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

function hasResultReusableSignal(surface: Surface): boolean {
  return looksResultLikeName(surface.displayName) ||
    hasNormalized(surface.keys, RESULT_HELPERS);
}

function hasOptionReusableSignal(surface: Surface): boolean {
  return looksOptionLikeName(surface.displayName) ||
    hasNormalized(surface.keys, OPTION_HELPERS);
}

function hasBrandMarker(surface: Surface): boolean {
  if (hasNormalized(surface.keys, BRAND_MARKERS)) return true;
  if (!hasNormalized(surface.keys, ["brand"])) return false;
  if (surface.displayName === null) return false;
  return hasNormalized(surface.stringLiterals, [surface.displayName]);
}

function getBrandHelperCastName(node: TSESTree.Node): string | null {
  let expression: TSESTree.Expression | null = null;
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
    if (!node.returnType || !node.body) return null;
    const statement = node.body.body[0];
    if (
      node.body.body.length !== 1 ||
      statement?.type !== AST_NODE_TYPES.ReturnStatement ||
      !statement.argument
    ) {
      return null;
    }
    expression = statement.argument;
  } else if (
    node.type === AST_NODE_TYPES.VariableDeclarator &&
    node.init &&
    (node.init.type === AST_NODE_TYPES.FunctionExpression ||
      node.init.type === AST_NODE_TYPES.ArrowFunctionExpression)
  ) {
    const fn = node.init;
    if (!fn.returnType) return null;
    if (fn.body.type === AST_NODE_TYPES.BlockStatement) {
      const statement = fn.body.body[0];
      if (
        fn.body.body.length !== 1 ||
        statement?.type !== AST_NODE_TYPES.ReturnStatement ||
        !statement.argument
      ) {
        return null;
      }
      expression = statement.argument;
    } else {
      expression = fn.body;
    }
  } else {
    return null;
  }

  const unwrapped =
    expression?.type === AST_NODE_TYPES.TSAsExpression ? expression : null;
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

function matchesBrandHelperName(
  surface: Surface,
  targetType: string,
): boolean {
  if (surface.displayName === null) return false;
  return (
    surface.displayName === targetType ||
    surface.displayName === `as${targetType}` ||
    surface.displayName === `make${targetType}` ||
    surface.displayName === `to${targetType}` ||
    BRAND_HELPER_RE.test(surface.displayName)
  );
}

function match(
  surface: Surface,
  kind: ManualAlgebraKind,
  messageId: ManualAlgebraMatch["messageId"],
  evidence: readonly string[],
): ManualAlgebraMatch {
  return {
    kind,
    messageId,
    node: surface.node,
    displayName: surface.displayName ?? "(anonymous)",
    evidence,
  };
}

export function isTransportDataShape(node: TSESTree.Node): boolean {
  const surface = surfaceFromNode(node);
  if (surface === null) return false;
  if (isTransportLikeName(surface.displayName)) return true;
  if (
    !looksResultLikeName(surface.displayName) &&
    !looksOptionLikeName(surface.displayName) &&
    hasDiscriminantStyle(surface) &&
    !hasNormalized(surface.keys, [...RESULT_HELPERS, ...OPTION_HELPERS])
  ) {
    return true;
  }
  return false;
}

export function isTaggedErrorCollision(node: TSESTree.Node): boolean {
  const surface = surfaceFromNode(node);
  if (surface === null || !surface.hasTagKey) return false;
  if (looksErrorLike(surface.displayName)) return true;
  return [...surface.stringLiterals].some((value) => looksErrorLike(value));
}

export function findManualResultMatch(
  node: TSESTree.Node,
): ManualAlgebraMatch | null {
  const surface = surfaceFromNode(node);
  if (surface === null) return null;
  if (isTransportDataShape(node) || isTaggedErrorCollision(node)) return null;
  if (!hasResultBranchPair(surface)) return null;
  if (!hasResultReusableSignal(surface)) return null;
  return match(surface, "result", "manualResult", [
    "result-like branch pair",
    "reusable success/failure surface",
  ]);
}

export function findManualOptionMatch(
  node: TSESTree.Node,
): ManualAlgebraMatch | null {
  const surface = surfaceFromNode(node);
  if (surface === null) return null;
  if (isTransportDataShape(node) || isTaggedErrorCollision(node)) return null;
  if (!hasOptionBranchPair(surface)) return null;
  if (!hasOptionReusableSignal(surface)) return null;
  return match(surface, "option", "manualOption", [
    "option-like branch pair",
    "reusable maybe-value surface",
  ]);
}

export function findManualBrandMatch(
  node: TSESTree.Node,
): ManualAlgebraMatch | null {
  const surface = surfaceFromNode(node);
  if (surface === null) return null;
  if (isTransportDataShape(node) || isTaggedErrorCollision(node)) return null;
  if (hasBrandMarker(surface)) {
    return match(surface, "brand", "manualBrand", [
      "brand marker field",
      "reusable nominal type surface",
    ]);
  }

  const targetType = getBrandHelperCastName(node);
  if (targetType === null) return null;
  if (!matchesBrandHelperName(surface, targetType)) return null;
  return match(surface, "brand", "manualBrand", [
    "brand helper cast",
    "reusable nominal helper",
  ]);
}
