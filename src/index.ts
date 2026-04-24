import { createRequire } from "node:module";
import type { TSESLint } from "@typescript-eslint/utils";
import asyncKeyword from "./rules/async-keyword.js";
import asUnknownAs from "./rules/as-unknown-as.js";
import bareCatch from "./rules/bare-catch.js";
import effectErrorErasure from "./rules/effect-error-erasure.js";
import effectPromise from "./rules/effect-promise.js";
import eitherDiscriminant from "./rules/either-discriminant.js";
import manualTaggedError from "./rules/manual-tagged-error.js";
import manualBrand from "./rules/manual-brand.js";
import manualOption from "./rules/manual-option.js";
import manualResult from "./rules/manual-result.js";
import noUnboundedConcurrency from "./rules/no-unbounded-concurrency.js";
import noCoverageThresholdGate from "./rules/no-coverage-threshold-gate.js";
import noHardcodedSecrets from "./rules/no-hardcoded-secrets.js";
import noManualEnumCast from "./rules/no-manual-enum-cast.js";
import noProcessEnvAtRuntime from "./rules/no-process-env-at-runtime.js";
import noRawThrowNewError from "./rules/no-raw-throw-new-error.js";
import noTestSkipOnly from "./rules/no-test-skip-only.js";
import noVitestMocks from "./rules/no-vitest-mocks.js";
import noHardcodedAssertionLiterals from "./rules/no-hardcoded-assertion-literals.js";
import noRawSql from "./rules/no-raw-sql.js";
import promiseType from "./rules/promise-type.js";
import recordCast from "./rules/record-cast.js";
import tagDiscriminant from "./rules/tag-discriminant.js";
import thenChain from "./rules/then-chain.js";

const rules = {
  "async-keyword": asyncKeyword,
  "as-unknown-as": asUnknownAs,
  "promise-type": promiseType,
  "then-chain": thenChain,
  "bare-catch": bareCatch,
  "effect-promise": effectPromise,
  "effect-error-erasure": effectErrorErasure,
  "either-discriminant": eitherDiscriminant,
  "manual-result": manualResult,
  "manual-option": manualOption,
  "manual-brand": manualBrand,
  "manual-tagged-error": manualTaggedError,
  "no-unbounded-concurrency": noUnboundedConcurrency,
  "no-process-env-at-runtime": noProcessEnvAtRuntime,
  "record-cast": recordCast,
  "no-raw-sql": noRawSql,
  "no-manual-enum-cast": noManualEnumCast,
  "no-vitest-mocks": noVitestMocks,
  "no-hardcoded-secrets": noHardcodedSecrets,
  "no-raw-throw-new-error": noRawThrowNewError,
  "no-test-skip-only": noTestSkipOnly,
  "no-coverage-threshold-gate": noCoverageThresholdGate,
  "no-hardcoded-assertion-literals": noHardcodedAssertionLiterals,
  "tag-discriminant": tagDiscriminant,
} as const;

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { name: string; version: string };

const meta = {
  name: pkg.name,
  version: pkg.version,
};

interface PluginConfig {
  plugins: { "agent-code-guard": Plugin };
  rules: Record<string, TSESLint.Linter.RuleLevel>;
}

interface Plugin {
  meta: typeof meta;
  rules: typeof rules;
  configs: {
    recommended: PluginConfig;
    integrationTests: PluginConfig;
  };
}

const plugin: Plugin = {
  meta,
  rules,
  configs: {
    recommended: {
      plugins: { "agent-code-guard": null! },
      rules: {
        "agent-code-guard/async-keyword": "error",
        "agent-code-guard/as-unknown-as": "error",
        "agent-code-guard/promise-type": "error",
        "agent-code-guard/then-chain": "error",
        "agent-code-guard/bare-catch": "error",
        "agent-code-guard/effect-promise": "error",
        "agent-code-guard/effect-error-erasure": "error",
        "agent-code-guard/either-discriminant": "error",
        "agent-code-guard/manual-result": "error",
        "agent-code-guard/manual-option": "error",
        "agent-code-guard/manual-brand": "warn",
        "agent-code-guard/manual-tagged-error": "error",
        "agent-code-guard/no-unbounded-concurrency": "error",
        "agent-code-guard/no-process-env-at-runtime": "error",
        "agent-code-guard/record-cast": "error",
        "agent-code-guard/no-raw-sql": "error",
        "agent-code-guard/no-manual-enum-cast": "error",
        "agent-code-guard/no-hardcoded-secrets": "error",
        "agent-code-guard/no-raw-throw-new-error": "error",
        "agent-code-guard/no-test-skip-only": "error",
        "agent-code-guard/no-coverage-threshold-gate": "warn",
        "agent-code-guard/no-hardcoded-assertion-literals": "warn",
        "agent-code-guard/tag-discriminant": "error",
      },
    },
    integrationTests: {
      plugins: { "agent-code-guard": null! },
      rules: {
        "agent-code-guard/no-vitest-mocks": "error",
      },
    },
  },
};

plugin.configs.recommended.plugins["agent-code-guard"] = plugin;
plugin.configs.integrationTests.plugins["agent-code-guard"] = plugin;

export default plugin;
