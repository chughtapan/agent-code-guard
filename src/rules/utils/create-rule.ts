/**
 * @file ESLint rule factory shared by every rule in the plugin. Uses
 * `RuleCreator.withoutDocs` so each rule's `meta.docs.url` survives
 * intact — rules anchor at their own principle in `PRINCIPLES.md`
 * rather than a uniform docs path.
 */

import { ESLintUtils } from "@typescript-eslint/utils";

/**
 * ESLint rule factory shared by every rule in the plugin. Each rule
 * supplies its own `meta.docs.url` (anchored at the principle it
 * projects from); the factory does not override it.
 */
export const createRule = ESLintUtils.RuleCreator.withoutDocs;
