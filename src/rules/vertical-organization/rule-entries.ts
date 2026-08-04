/**
 * @file Defines the shared enabled rule entries and pinned options for vertical organization.
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
 * Shared rule entries consumed by the plugin and repository lint configuration.
 */
export const verticalOrganizationRuleEntries: Record<string, RuleEntry> = {
  "@typescript-eslint/adjacent-overload-signatures": "error",
  "agent-code-guard/no-vacuous-jsdoc": "error",
  "agent-code-guard/prefer-stepdown-function-order": "error",
  "agent-code-guard/require-stable-file-shell": "error",
  "import-x/first": "error",
  "jsdoc/require-file-overview": "error",
  "perfectionist/sort-export-attributes": ["error", alphabeticalCommentPartitionOptions],
  "perfectionist/sort-exports": ["error", alphabeticalCommentPartitionOptions],
  "perfectionist/sort-heritage-clauses": ["error", alphabeticalCommentPartitionOptions],
  "perfectionist/sort-import-attributes": ["error", alphabeticalCommentPartitionOptions],
  "perfectionist/sort-imports": [
    "error",
    { ...alphabeticalCommentPartitionOptions, sortSideEffects: false },
  ],
  "perfectionist/sort-named-exports": ["error", alphabeticalCommentPartitionOptions],
  "perfectionist/sort-named-imports": ["error", alphabeticalCommentPartitionOptions],
};
