import type { TSESLint } from "@typescript-eslint/utils";
import asyncKeyword from "./rules/async-keyword.js";
import bareCatch from "./rules/bare-catch.js";
import noHardcodedSecrets from "./rules/no-hardcoded-secrets.js";
import noManualEnumCast from "./rules/no-manual-enum-cast.js";
import noVitestMocks from "./rules/no-vitest-mocks.js";
import noRawSql from "./rules/no-raw-sql.js";
import promiseType from "./rules/promise-type.js";
import recordCast from "./rules/record-cast.js";
import thenChain from "./rules/then-chain.js";

const rules = {
  "async-keyword": asyncKeyword,
  "promise-type": promiseType,
  "then-chain": thenChain,
  "bare-catch": bareCatch,
  "record-cast": recordCast,
  "no-raw-sql": noRawSql,
  "no-manual-enum-cast": noManualEnumCast,
  "no-vitest-mocks": noVitestMocks,
  "no-hardcoded-secrets": noHardcodedSecrets,
} as const;

const meta = {
  name: "eslint-plugin-agent-code-guard",
  version: "0.1.0",
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
      plugins: { "agent-code-guard": undefined as unknown as Plugin },
      rules: {
        "agent-code-guard/async-keyword": "error",
        "agent-code-guard/promise-type": "error",
        "agent-code-guard/then-chain": "error",
        "agent-code-guard/bare-catch": "error",
        "agent-code-guard/record-cast": "error",
        "agent-code-guard/no-raw-sql": "error",
        "agent-code-guard/no-manual-enum-cast": "error",
        "agent-code-guard/no-hardcoded-secrets": "error",
      },
    },
    integrationTests: {
      plugins: { "agent-code-guard": undefined as unknown as Plugin },
      rules: {
        "agent-code-guard/no-vitest-mocks": "error",
      },
    },
  },
};

plugin.configs.recommended.plugins["agent-code-guard"] = plugin;
plugin.configs.integrationTests.plugins["agent-code-guard"] = plugin;

export default plugin;
