import type { TSESLint } from "@typescript-eslint/utils";
import { asyncFlowRules } from "./async-flow/index.js";
import { effectRules } from "./effect/index.js";
import { manualAlgebraRules } from "./manual-algebra/index.js";
import { safetyRules } from "./safety/index.js";
import { testingRules } from "./testing/index.js";
import { toolingRules } from "./tooling/index.js";

type RuleEntry = TSESLint.Linter.RuleEntry;

export const syntaxRules = {
  ...asyncFlowRules,
  ...effectRules,
  ...manualAlgebraRules,
  ...safetyRules,
  ...testingRules,
  ...toolingRules,
} as const;

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

export const integrationTestRuleEntries: Record<string, RuleEntry> = {
  "agent-code-guard/no-vitest-mocks": "error",
};
