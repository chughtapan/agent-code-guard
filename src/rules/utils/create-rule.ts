/**
 * @file ESLint rule factory shared by every rule in the plugin. Each
 * rule supplies its own `meta.docs.description` (one-line rationale)
 * and `meta.docs.url` (anchor in safer-by-default's `PRINCIPLES.md`).
 * LSPs propagate both fields via the standard ESLint diagnostic
 * protocol so the agent's inline link points at the principle the
 * rule projects from.
 */

import { ESLintUtils } from "@typescript-eslint/utils";

/**
 * ESLint rule factory. Delegates to `RuleCreator.withoutDocs` so each
 * rule's `meta.docs.url` is preserved verbatim — the principle anchor
 * lives in the rule file, not in this factory.
 */
export const createRule = ESLintUtils.RuleCreator.withoutDocs;
