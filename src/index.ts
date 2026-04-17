import type { TSESLint } from "@typescript-eslint/utils";
import asyncKeyword from "./rules/async-keyword.js";
import bareCatch from "./rules/bare-catch.js";
import promiseType from "./rules/promise-type.js";
import recordCast from "./rules/record-cast.js";
import thenChain from "./rules/then-chain.js";

const rules = {
  "async-keyword": asyncKeyword,
  "promise-type": promiseType,
  "then-chain": thenChain,
  "bare-catch": bareCatch,
  "record-cast": recordCast,
} as const;

const meta = {
  name: "eslint-plugin-sloppy-code-guard",
  version: "0.1.0",
};

interface RecommendedConfig {
  plugins: { "sloppy-code-guard": Plugin };
  rules: Record<string, TSESLint.Linter.RuleLevel>;
}

interface Plugin {
  meta: typeof meta;
  rules: typeof rules;
  configs: { recommended: RecommendedConfig };
}

const plugin: Plugin = {
  meta,
  rules,
  configs: {
    recommended: {
      // Filled below — avoids self-reference in an initializer.
      plugins: { "sloppy-code-guard": undefined as unknown as Plugin },
      rules: {
        "sloppy-code-guard/async-keyword": "error",
        "sloppy-code-guard/promise-type": "error",
        "sloppy-code-guard/then-chain": "error",
        "sloppy-code-guard/bare-catch": "error",
        "sloppy-code-guard/record-cast": "error",
      },
    },
  },
};

plugin.configs.recommended.plugins["sloppy-code-guard"] = plugin;

export default plugin;
