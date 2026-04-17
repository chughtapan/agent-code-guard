import { createRequire } from "node:module";
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

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { name: string; version: string };

const meta = {
  name: pkg.name,
  version: pkg.version,
};

interface PluginConfig {
  plugins: { "safer-by-default": Plugin };
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
      plugins: { "safer-by-default": undefined as unknown as Plugin },
      rules: {
        "safer-by-default/async-keyword": "error",
        "safer-by-default/promise-type": "error",
        "safer-by-default/then-chain": "error",
        "safer-by-default/bare-catch": "error",
        "safer-by-default/record-cast": "error",
        "safer-by-default/no-raw-sql": "error",
        "safer-by-default/no-manual-enum-cast": "error",
        "safer-by-default/no-hardcoded-secrets": "error",
      },
    },
    integrationTests: {
      plugins: { "safer-by-default": undefined as unknown as Plugin },
      rules: {
        "safer-by-default/no-vitest-mocks": "error",
      },
    },
  },
};

plugin.configs.recommended.plugins["safer-by-default"] = plugin;
plugin.configs.integrationTests.plugins["safer-by-default"] = plugin;

export default plugin;
