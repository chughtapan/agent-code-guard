/**
 * @file Central plugin rule registry. Aggregates every rule family map
 * (`syntaxRules`) and exposes the `recommended` and `integrationTests`
 * rule severity entries used by the preset surface.
 */

import type { TSESLint } from "@typescript-eslint/utils";
import { asyncFlowRules } from "./async-flow/index.js";
import { effectRules } from "./effect/index.js";
import { manualAlgebraRules } from "./manual-algebra/index.js";
import { safetyRules } from "./safety/index.js";
import { testingRules } from "./testing/index.js";
import { toolingRules } from "./tooling/index.js";

type RuleEntry = TSESLint.Linter.RuleEntry;

/**
 * Combined map of every syntax-level rule family (async-flow, effect,
 * manual-algebra, safety, testing, tooling).
 */
export const syntaxRules = {
  ...asyncFlowRules,
  ...effectRules,
  ...manualAlgebraRules,
  ...safetyRules,
  ...testingRules,
  ...toolingRules,
} as const;

/**
 * Curated severity entries for every syntax-level rule in the
 * `recommended` preset. Clear bugs run at `error`; heuristic /
 * judgement-dependent rules run at `warn`.
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
  "agent-code-guard/fork-requires-lifecycle": "warn",
  "agent-code-guard/prefer-decode-effect-at-boundary": "warn",
  "agent-code-guard/require-span-on-exported-effect": "warn",
  "agent-code-guard/handler-requires-span": "warn",
  "agent-code-guard/logger-config-at-boot": "warn",
  "agent-code-guard/prefer-annotate-logs": "warn",
  "agent-code-guard/annotate-without-span": "warn",
  "agent-code-guard/prefer-config-redacted": "warn",
  "agent-code-guard/effect-foreach-requires-concurrency": "warn",
  "agent-code-guard/acquire-release-requires-scope": "warn",
  "agent-code-guard/finalizer-requires-scope": "warn",
  "agent-code-guard/parse-into-schema-requires-effect": "warn",
  "agent-code-guard/manual-result": "error",
  "agent-code-guard/manual-option": "error",
  "agent-code-guard/manual-brand": "warn",
  "agent-code-guard/no-manual-brand-constructor": "warn",
  "agent-code-guard/manual-tagged-error": "error",
  "agent-code-guard/no-conditional-chaining": "warn",
  "agent-code-guard/no-effect-error-coalescing": "warn",
  "agent-code-guard/no-example-only-tests": "warn",
  "agent-code-guard/no-exported-brand-constructor": "warn",
  "agent-code-guard/no-unbounded-concurrency": "error",
  "agent-code-guard/no-process-env-at-runtime": "error",
  "agent-code-guard/no-env-nonnull-assert": "error",
  "agent-code-guard/record-cast": "error",
  "agent-code-guard/no-raw-sql": "error",
  "agent-code-guard/no-manual-enum-cast": "error",
  "agent-code-guard/no-raw-throw-new-error": "error",
  "agent-code-guard/no-test-skip-only": "error",
  "agent-code-guard/no-coverage-threshold-gate": "warn",
  "agent-code-guard/no-hardcoded-assertion-literals": "warn",
  "agent-code-guard/tag-discriminant": "error",
  "agent-code-guard/require-knip-in-lint": "error",
};

/**
 * Severity entries for the `integrationTests` preset. Forbids mocks in
 * files matched by the consumer's integration-test glob.
 */
export const integrationTestRuleEntries: Record<string, RuleEntry> = {
  "agent-code-guard/no-vitest-mocks": "error",
};
