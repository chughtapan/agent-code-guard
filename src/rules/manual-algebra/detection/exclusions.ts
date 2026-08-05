/**
 * @file False-positive exclusions for transport-data and tagged-error
 * surfaces in manual-algebra detection.
 */

import { hasNormalized, type Surface } from "./surface.js";

const TRANSPORT_NAME_RE =
  /(Request|Response|Payload|Dto|DTO|Event|State|Config|Schema|Record|Snapshot|Params|Props|Options|Row|Json|JSON)$/;
const ERROR_NAME_RE = /(^err(or)?$|Error$|Failure$|Failed$|Exception$)/i;
const RESULT_NAME_RE = /(Result|Either|Outcome|Try)$/;
const OPTION_NAME_RE = /(Option|Maybe)$/;
const TRANSPORT_HELPERS = new Set([
  "andthen",
  "flatmap",
  "fold",
  "getorelse",
  "hasvalue",
  "iserr",
  "isfailure",
  "isleft",
  "isnone",
  "isok",
  "isright",
  "issome",
  "issuccess",
  "map",
  "maperror",
  "match",
  "unwrapor",
]);

/**
 * Tests whether a surface is ordinary transport data rather than a reusable
 * result or option algebra.
 * @param surface The normalized declaration surface.
 * @returns Whether manual-algebra diagnostics should exclude it as transport data.
 */
export function isTransportDataSurface(surface: Surface): boolean {
  if (displayNameMatches(surface, TRANSPORT_NAME_RE)) {
    return true;
  }
  if (surface.kind === "function") {
    return false;
  }
  if (displayNameMatches(surface, RESULT_NAME_RE) || displayNameMatches(surface, OPTION_NAME_RE)) {
    return false;
  }
  return hasDiscriminantStyle(surface) && !hasNormalized(surface.keys, TRANSPORT_HELPERS);
}

/**
 * Tests whether a surface is a tagged error rather than a general algebra.
 * @param surface The normalized declaration surface.
 * @returns Whether manual-algebra diagnostics should exclude it as an error.
 */
export function isTaggedErrorSurface(surface: Surface): boolean {
  if (!surface.hasTagKey) {
    return false;
  }
  if (displayNameMatches(surface, ERROR_NAME_RE)) {
    return true;
  }
  return [...surface.stringLiterals].some((value) => ERROR_NAME_RE.test(value));
}

function hasDiscriminantStyle(surface: Surface): boolean {
  return surface.hasTagKey || hasNormalized(surface.keys, ["type", "kind", "status"]);
}

function displayNameMatches(surface: Surface, pattern: RegExp): boolean {
  return surface.displayName !== null && pattern.test(surface.displayName);
}
