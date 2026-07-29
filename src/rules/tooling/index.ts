/**
 * @file Tooling rule registry. Exports the family's rule map for the
 * plugin entry; each member rule lives in a sibling file.
 */

import { requireKnipInLint } from "./require-knip-in-lint.js";
import { requireTypeScriptQualityGate } from "./require-typescript-quality-gate.js";

/**
 * Tooling rule family. Catches misconfigurations in the build/quality
 * tooling itself: default quality scripts that omit dead-code detection or
 * type checking, and compiler configurations below the required strict floor.
 */
export const toolingRules = {
  "require-knip-in-lint": requireKnipInLint,
  "require-typescript-quality-gate": requireTypeScriptQualityGate,
} as const;
