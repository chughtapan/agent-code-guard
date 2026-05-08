import type { TSESTree } from "@typescript-eslint/utils";
import {
  hasKeyPair,
  hasLiteralPair,
  hasNormalized,
  normalize,
  type Surface,
  surfaceFromNode,
} from "./surface.js";

type ManualAlgebraKind = "result" | "option" | "brand";

export interface ManualAlgebraMatch {
  readonly kind: ManualAlgebraKind;
  readonly displayName: string;
  readonly messageId: "manualResult" | "manualOption" | "manualBrand";
  readonly node: TSESTree.Node;
}

const TRANSPORT_NAME_RE =
  /(Request|Response|Payload|Dto|DTO|Event|State|Config|Schema|Record|Snapshot|Params|Props|Options|Row|Json|JSON)$/;
const ERROR_NAME_RE = /(^err(or)?$|Error$|Failure$|Failed$|Exception$)/i;
const RESULT_NAME_RE = /(Result|Either|Outcome|Try)$/;
const OPTION_NAME_RE = /(Option|Maybe)$/;

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

function looksResultLikeName(name: string): boolean {
  return typeof name === "string" && RESULT_NAME_RE.test(name);
}

function looksOptionLikeName(name: string): boolean {
  return typeof name === "string" && OPTION_NAME_RE.test(name);
}

function isTransportLikeName(name: string): boolean {
  return typeof name === "string" && TRANSPORT_NAME_RE.test(name);
}

function looksErrorLike(value: string): boolean {
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

function hasSurfaceKeyOrLiteral(surface: Surface, name: string): boolean {
  return hasKeys(surface, [name]) ||
    hasNormalized(surface.stringLiterals, [name]);
}

function hasOkFunctionEvidence(surface: Surface): boolean {
  return hasKeys(surface, ["ok"]) &&
    (hasKeys(surface, ["value"]) || hasBooleanLiteral(surface, "true"));
}

function hasErrorFunctionEvidence(surface: Surface): boolean {
  return hasKeys(surface, ["error", "err"]) ||
    (hasKeys(surface, ["ok"]) && hasBooleanLiteral(surface, "false"));
}

function hasNamedResultBranchEvidence(name: string): (surface: Surface) => boolean {
  return (surface) => hasSurfaceKeyOrLiteral(surface, name);
}

const RESULT_FUNCTION_EVIDENCE = new Map<string, (surface: Surface) => boolean>([
  ["ok", hasOkFunctionEvidence],
  ["err", hasErrorFunctionEvidence],
  ["error", hasErrorFunctionEvidence],
  ["isok", (surface) => hasKeys(surface, ["ok"])],
  ["iserr", hasErrorFunctionEvidence],
  ["isleft", hasNamedResultBranchEvidence("left")],
  ["isright", hasNamedResultBranchEvidence("right")],
  ["issuccess", hasNamedResultBranchEvidence("success")],
  ["isfailure", hasNamedResultBranchEvidence("failure")],
]);

function hasResultFunctionEvidence(surface: Surface): boolean {
  if (surface.kind !== "function") return hasResultBranchPair(surface);
  const name = getNormalizedDisplayName(surface);
  if (name === null) return false;
  const evidence = RESULT_FUNCTION_EVIDENCE.get(name);
  if (evidence !== undefined) return evidence(surface);
  if (SOME_RESULT_NAMES.has(name)) return hasSurfaceKeyOrLiteral(surface, name);
  return hasResultBranchPair(surface);
}

function hasSomeOptionEvidence(surface: Surface): boolean {
  return hasTaggedLiterals(surface, SOME_OPTION_NAMES) || hasKeys(surface, ["value"]);
}

function hasNoneOptionEvidence(surface: Surface): boolean {
  return hasTaggedLiterals(surface, NONE_OPTION_NAMES) ||
    hasKeys(surface, NONE_OPTION_NAMES);
}

const OPTION_FUNCTION_EVIDENCE = new Map<string, (surface: Surface) => boolean>([
  ["some", hasSomeOptionEvidence],
  ["present", hasSomeOptionEvidence],
  ["issome", hasSomeOptionEvidence],
  ["hasvalue", hasSomeOptionEvidence],
  ["none", hasNoneOptionEvidence],
  ["absent", hasNoneOptionEvidence],
  ["isnone", (surface) => hasTaggedLiterals(surface, NONE_OPTION_NAMES)],
]);

function hasOptionFunctionEvidence(surface: Surface): boolean {
  if (surface.kind !== "function") return hasOptionBranchPair(surface);
  const name = getNormalizedDisplayName(surface);
  if (name === null) return false;
  const evidence = OPTION_FUNCTION_EVIDENCE.get(name);
  if (evidence !== undefined) return evidence(surface);
  return hasOptionBranchPair(surface);
}

function hasResultReusableSignal(surface: Surface): boolean {
  return displayNameLooksResultLike(surface) ||
    hasNormalizedDisplayName(surface, RESULT_FUNCTION_NAMES) ||
    hasNormalized(surface.keys, RESULT_HELPERS);
}

function hasOptionReusableSignal(surface: Surface): boolean {
  return displayNameLooksOptionLike(surface) ||
    hasNormalizedDisplayName(surface, OPTION_FUNCTION_NAMES) ||
    hasNormalized(surface.keys, OPTION_HELPERS);
}

function hasBrandMarker(surface: Surface): boolean {
  return hasKeys(surface, BRAND_MARKERS) ||
    (surface.displayName !== null &&
      hasKeys(surface, ["brand"]) &&
      hasNormalized(surface.stringLiterals, [surface.displayName]));
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
  if (name !== null && isTransportLikeName(name)) return true;
  if (surface.kind === "function") return false;
  if (displayNameLooksResultLike(surface) || displayNameLooksOptionLike(surface)) return false;
  return hasDiscriminantStyle(surface) && !hasKeys(surface, TRANSPORT_HELPERS);
}

function isTaggedErrorSurface(surface: Surface): boolean {
  return surface.hasTagKey &&
    (displayNameLooksErrorLike(surface) ||
      [...surface.stringLiterals].some((value) => looksErrorLike(value)));
}

function displayNameLooksResultLike(surface: Surface): boolean {
  return surface.displayName !== null && looksResultLikeName(surface.displayName);
}

function displayNameLooksOptionLike(surface: Surface): boolean {
  return surface.displayName !== null && looksOptionLikeName(surface.displayName);
}

function displayNameLooksErrorLike(surface: Surface): boolean {
  return surface.displayName !== null && looksErrorLike(surface.displayName);
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
  return null;
}
