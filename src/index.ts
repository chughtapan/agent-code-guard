import { createRequire } from "node:module";
import type { TSESLint } from "@typescript-eslint/utils";
import sonarjs from "eslint-plugin-sonarjs";
import {
  architecturePresetRuleEntries,
  architectureRules,
  recommendedArchitectureRuleEntries,
} from "./rules/architecture/plugin-rules.js";
import {
  integrationTestRuleEntries,
  recommendedSyntaxRuleEntries,
  syntaxRules,
} from "./rules/registry.js";

const rules = {
  ...syntaxRules,
  ...architectureRules,
} as const;

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { name: string; version: string };

const meta = {
  name: pkg.name,
  version: pkg.version,
};

interface PluginConfig {
  plugins: Record<string, unknown>;
  rules: Record<string, TSESLint.Linter.RuleEntry>;
  settings?: Record<string, unknown>;
}

interface Plugin {
  meta: typeof meta;
  rules: typeof rules;
  configs: {
    recommended: PluginConfig;
    strict: PluginConfig;
    integrationTests: PluginConfig;
    architecture: PluginConfig;
  };
}

const sonarRecommendedConfig = sonarjs.configs.recommended;

const strictComplexityRuleEntries: Record<string, TSESLint.Linter.RuleEntry> = {
  complexity: ["error", { max: 8 }],
  "max-classes-per-file": ["error", 1],
  "max-depth": ["error", 3],
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": [
    "error",
    { max: 50, skipBlankLines: true, skipComments: true, IIFEs: true },
  ],
  "max-nested-callbacks": ["error", 3],
  "max-params": ["error", 4],
  "max-statements": ["error", 30],
  "max-statements-per-line": ["error", { max: 1 }],
  "no-nested-ternary": "error",
  "sonarjs/cognitive-complexity": ["error", 8],
  "sonarjs/cyclomatic-complexity": ["error", { threshold: 8 }],
  "sonarjs/expression-complexity": ["error", { max: 3 }],
  "sonarjs/max-lines": ["error", { maximum: 300 }],
  "sonarjs/max-lines-per-function": ["error", { maximum: 50 }],
  "sonarjs/nested-control-flow": ["error", { maximumNestingLevel: 3 }],
  "sonarjs/no-function-declaration-in-block": "error",
  "sonarjs/no-nested-switch": "error",
  "sonarjs/too-many-break-or-continue-in-loop": "error",
};

const plugin: Plugin = {
  meta,
  rules,
  configs: {
    recommended: {
      plugins: { "agent-code-guard": null! },
      rules: {
        ...recommendedSyntaxRuleEntries,

        // Architecture rules: clear bugs (cycles, exposed internals, uncurated
        // public boundaries) at error; judgment calls (heuristic thresholds,
        // layered/domain assumptions) at warn. The full set is also available
        // standalone via configs.architecture (all warn-level) for incremental
        // adoption.
        ...recommendedArchitectureRuleEntries,
      },
    },
    strict: {
      plugins: {
        "agent-code-guard": null!,
        sonarjs,
      },
      rules: {
        ...sonarRecommendedConfig.rules,
        ...recommendedSyntaxRuleEntries,
        ...recommendedArchitectureRuleEntries,
        ...strictComplexityRuleEntries,
      } as Record<string, TSESLint.Linter.RuleEntry>,
      settings: sonarRecommendedConfig.settings as Record<string, unknown> | undefined,
    },
    integrationTests: {
      plugins: { "agent-code-guard": null! },
      rules: integrationTestRuleEntries,
    },
    architecture: {
      plugins: { "agent-code-guard": null! },
      rules: architecturePresetRuleEntries,
    },
  },
};

plugin.configs.recommended.plugins["agent-code-guard"] = plugin;
plugin.configs.strict.plugins["agent-code-guard"] = plugin;
plugin.configs.integrationTests.plugins["agent-code-guard"] = plugin;
plugin.configs.architecture.plugins["agent-code-guard"] = plugin;

export default plugin;
