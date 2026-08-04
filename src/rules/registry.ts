/**
 * @file Central plugin rule registry. Aggregates every rule family map
 * (`syntaxRules`) and exposes the `recommended` and `integrationTests`
 * rule severity entries used by the preset surface.
 */

import type { TSESLint } from "@typescript-eslint/utils";
import { asyncFlowRules } from "./async-flow/index.js";
import { effectRules } from "./effect/index.js";
import { googleStyleRuleEntries, googleStyleRules } from "./google-style/index.js";
import { manualAlgebraRules } from "./manual-algebra/index.js";
import { safetyRules } from "./safety/index.js";
import { testingRules } from "./testing/index.js";
import { toolingRules } from "./tooling/index.js";
import { verticalOrganizationRules } from "./vertical-organization/index.js";
import { verticalOrganizationRuleEntries } from "./vertical-organization/rule-entries.js";

type RuleEntry = TSESLint.Linter.RuleEntry;

/**
 * Combined map of every syntax-level rule family (async-flow, effect,
 * manual-algebra, safety, testing, tooling).
 */
export const syntaxRules = {
  ...asyncFlowRules,
  ...effectRules,
  ...googleStyleRules,
  ...manualAlgebraRules,
  ...safetyRules,
  ...testingRules,
  ...toolingRules,
  ...verticalOrganizationRules,
} as const;

/**
 * Curated severity entries for every syntax-level rule in the
 * `recommended` preset. Agent Code Guard is normative: every enabled
 * diagnostic blocks lint.
 */
export const recommendedSyntaxRuleEntries: Record<string, RuleEntry> = {
  "agent-code-guard/async-keyword": "error",
  "agent-code-guard/as-unknown-as": "error",
  "agent-code-guard/promise-type": "error",
  "agent-code-guard/then-chain": "error",
  "agent-code-guard/bare-catch": "error",
  "agent-code-guard/effect-promise": "error",
  "agent-code-guard/effect-error-erasure": "error",
  "agent-code-guard/either-discriminant": "error",
  "agent-code-guard/no-console-in-effect": "error",
  "agent-code-guard/no-promise-all-in-effect": "error",
  "agent-code-guard/prefer-effect-platform": "error",
  "agent-code-guard/no-schema-type-cast": "error",
  "agent-code-guard/runpromise-requires-scoped": "error",
  "agent-code-guard/fork-requires-lifecycle": "error",
  "agent-code-guard/prefer-decode-effect-at-boundary": "error",
  "agent-code-guard/require-span-on-exported-effect": "error",
  "agent-code-guard/handler-requires-span": "error",
  "agent-code-guard/logger-config-at-boot": "error",
  "agent-code-guard/prefer-annotate-logs": "error",
  "agent-code-guard/annotate-without-span": "error",
  "agent-code-guard/prefer-config-redacted": "error",
  "agent-code-guard/effect-foreach-requires-concurrency": "error",
  "agent-code-guard/acquire-release-requires-scope": "error",
  "agent-code-guard/finalizer-requires-scope": "error",
  "agent-code-guard/parse-into-schema-requires-effect": "error",
  "agent-code-guard/manual-result": "error",
  "agent-code-guard/manual-option": "error",
  "agent-code-guard/manual-brand": "error",
  "agent-code-guard/no-manual-brand-constructor": "error",
  "agent-code-guard/manual-tagged-error": "error",
  "agent-code-guard/no-conditional-chaining": "error",
  "agent-code-guard/no-effect-error-coalescing": "error",
  "agent-code-guard/no-example-only-tests": "error",
  "agent-code-guard/no-exported-brand-constructor": "error",
  "agent-code-guard/no-unbounded-concurrency": "error",
  "agent-code-guard/no-process-env-at-runtime": "error",
  "agent-code-guard/no-env-nonnull-assert": "error",
  "agent-code-guard/record-cast": "error",
  "agent-code-guard/no-raw-sql": "error",
  "agent-code-guard/no-manual-enum-cast": "error",
  "agent-code-guard/no-raw-throw-new-error": "error",
  "agent-code-guard/no-test-skip-only": "error",
  "agent-code-guard/no-coverage-threshold-gate": "error",
  "agent-code-guard/no-hardcoded-assertion-literals": "error",
  "agent-code-guard/tag-discriminant": "error",
  "agent-code-guard/require-knip-in-lint": "error",
  ...verticalOrganizationRuleEntries,
  ...googleStyleRuleEntries,
};

/**
 * Severity entries for the `integrationTests` preset. Forbids mocks in
 * files matched by the consumer's integration-test glob.
 */
export const integrationTestRuleEntries: Record<string, RuleEntry> = {
  "agent-code-guard/no-vitest-mocks": "error",
};
