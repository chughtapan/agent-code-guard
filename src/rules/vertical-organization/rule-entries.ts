/**
 * @file Disabled PR 1 entries for the vertical-organization rule family.
 *
 * The entry options are retained when PR 2 promotes this family to errors.
 */

import type { TSESLint } from "@typescript-eslint/utils";

type RuleEntry = TSESLint.Linter.RuleEntry;

const alphabeticalCommentPartitionOptions = {
  ignoreCase: true,
  newlinesBetween: "ignore",
  order: "asc",
  partitionByComment: true,
  specialCharacters: "keep",
  type: "alphabetical",
} as const;

/**
 * Rule entries shipped disabled with PR 1 and enabled by the reviewed PR 2
 * migration only after the stable-shell gate is clean.
 */
export const verticalOrganizationRuleEntries: Record<string, RuleEntry> = {
  "@typescript-eslint/adjacent-overload-signatures": "off",
  "agent-code-guard/no-vacuous-jsdoc": "off",
  "agent-code-guard/prefer-stepdown-function-order": "off",
  "agent-code-guard/require-stable-file-shell": "off",
  "import-x/first": "off",
  "jsdoc/require-file-overview": "off",
  "perfectionist/sort-export-attributes": ["off", alphabeticalCommentPartitionOptions],
  "perfectionist/sort-exports": ["off", alphabeticalCommentPartitionOptions],
  "perfectionist/sort-heritage-clauses": ["off", alphabeticalCommentPartitionOptions],
  "perfectionist/sort-import-attributes": ["off", alphabeticalCommentPartitionOptions],
  "perfectionist/sort-imports": [
    "off",
    { ...alphabeticalCommentPartitionOptions, sortSideEffects: false },
  ],
  "perfectionist/sort-named-exports": ["off", alphabeticalCommentPartitionOptions],
  "perfectionist/sort-named-imports": ["off", alphabeticalCommentPartitionOptions],
};
