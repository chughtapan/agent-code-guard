/**
 * @file Tooling rule registry. Exports the family's rule map for the
 * plugin entry; each member rule lives in a sibling file.
 */

import requireKnipInLint from "./require-knip-in-lint.js";

/**
 * Tooling rule family. Catches misconfigurations in the build/quality
 * tooling itself — currently, `package.json` quality scripts that omit
 * dead-code detection.
 */
export const toolingRules = {
  "require-knip-in-lint": requireKnipInLint,
} as const;
