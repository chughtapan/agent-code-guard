/**
 * @file Shared anchors into safer-by-default's `PRINCIPLES.md`. Every
 * rule's `meta.docs.url` references one of these constants so a repo
 * rename or heading restructure is a one-file edit, not a 47-file
 * find-replace.
 */

const PRINCIPLES_URL_BASE =
  "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md";

/**
 * Public URL of the `PRINCIPLES.md` heading set. Exported for tests
 * that need to assert rule URLs share a common origin.
 */
export const SAFER_PRINCIPLES_URL = PRINCIPLES_URL_BASE;

/**
 * Per-principle anchored URLs into `PRINCIPLES.md`. Keys name the
 * principle; values are full URLs ready to drop into `meta.docs.url`.
 */
export const PRINCIPLE_URL = {
  TYPES_BEAT_TESTS: `${PRINCIPLES_URL_BASE}#1-types-beat-tests--move-constraints-into-the-type-system`,
  VALIDATE_AT_BOUNDARY: `${PRINCIPLES_URL_BASE}#2-validate-at-every-boundary--schemas-where-data-enters-types-inside`,
  ERRORS_ARE_TYPED: `${PRINCIPLES_URL_BASE}#3-errors-are-typed-not-thrown--tagged-errors-or-typed-results-no-raw-throws-no-silent-catches`,
  EXHAUSTIVENESS: `${PRINCIPLES_URL_BASE}#4-exhaustiveness-over-optionality--every-branch-handled-switches-end-in-never`,
  DISCIPLINE: `${PRINCIPLES_URL_BASE}#5-discipline-over-capability`,
  BUDGET_GATE: `${PRINCIPLES_URL_BASE}#6-the-budget-gate--scope-is-a-hard-budget`,
} as const;
