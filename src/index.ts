/**
 * @file Plugin entry point. Assembles every rule family, composes the
 * presets (`recommended`, `strict`, `documentation`, `integrationTests`,
 * `architecture`), and bundles `eslint-plugin-sonarjs` and
 * `eslint-plugin-jsdoc` so consumers do not install them separately.
 */

import { createRequire } from "node:module";
import type { TSESLint } from "@typescript-eslint/utils";
import jsdoc from "eslint-plugin-jsdoc";
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
    documentation: PluginConfig;
  };
}

const jsdocLogicalRules = jsdoc.configs["flat/logical-typescript-error"]?.rules ?? {};
const jsdocContentsRules = jsdoc.configs["flat/contents-typescript-error"]?.rules ?? {};
const jsdocStylisticRules = jsdoc.configs["flat/stylistic-typescript-error"]?.rules ?? {};
const jsdocRequirementsRules =
  jsdoc.configs["flat/requirements-typescript-error"]?.rules ?? {};

const pickEnabled = (
  src: Record<string, TSESLint.Linter.RuleEntry | undefined>,
): Record<string, TSESLint.Linter.RuleEntry> =>
  Object.fromEntries(
    Object.entries(src).filter(
      (entry): entry is [string, TSESLint.Linter.RuleEntry] => entry[1] !== undefined,
    ),
  );

const jsdocRequireRuleForBarrelExports: TSESLint.Linter.RuleEntry = [
  "error",
  {
    publicOnly: { ancestorsOnly: true, esm: true, cjs: false, window: false },
    require: {
      FunctionDeclaration: false,
      ClassDeclaration: false,
      MethodDefinition: false,
      ArrowFunctionExpression: false,
      FunctionExpression: false,
    },
    contexts: [
      "ExportNamedDeclaration > TSTypeAliasDeclaration",
      "ExportNamedDeclaration > TSInterfaceDeclaration",
      "ExportNamedDeclaration > TSEnumDeclaration",
      "ExportNamedDeclaration > VariableDeclaration",
      "ExportNamedDeclaration > FunctionDeclaration",
      "ExportNamedDeclaration > ClassDeclaration",
    ],
    enableFixer: false,
  },
];

const jsdocRecommendedRuleEntries: Record<string, TSESLint.Linter.RuleEntry> = {
  ...pickEnabled(jsdocLogicalRules),
  ...pickEnabled(jsdocContentsRules),
  // TypeScript handles type-name resolution; pairing this with no-types: error
  // would emit two diagnostics on every `@param {T}` line.
  "jsdoc/no-undefined-types": "off",
};

const jsdocStrictRuleEntries: Record<string, TSESLint.Linter.RuleEntry> = {
  ...jsdocRecommendedRuleEntries,
  ...pickEnabled(jsdocStylisticRules),
};

const documentationPresetRuleEntries: Record<string, TSESLint.Linter.RuleEntry> = {
  ...jsdocRecommendedRuleEntries,
  ...pickEnabled(jsdocRequirementsRules),
  ...pickEnabled(jsdocStylisticRules),
  "jsdoc/require-jsdoc": jsdocRequireRuleForBarrelExports,
  "jsdoc/require-file-overview": "error",
  "jsdoc/require-description": "error",
  "jsdoc/require-description-complete-sentence": "error",
  "jsdoc/require-hyphen-before-param-description": ["error", "never"],
  "jsdoc/check-indentation": "error",
  "jsdoc/check-line-alignment": "error",
  "jsdoc/match-description": "error",
  "jsdoc/no-bad-blocks": "error",
  "jsdoc/no-blank-block-descriptions": "error",
  "jsdoc/no-blank-blocks": "error",
  "jsdoc/lines-before-block": "error",
  "jsdoc/multiline-blocks": "error",
  "jsdoc/tag-lines": "error",
  // TypeScript already provides types; @param {string} is redundant noise.
  "jsdoc/require-param-type": "off",
  "jsdoc/require-returns-type": "off",
  "jsdoc/no-types": "error",
  // @example is too aggressive for type-export-only barrels (interfaces,
  // type aliases). Functions and consts that need an example can opt in.
  "jsdoc/require-example": "off",
};

const sonarRecommendedConfig = sonarjs.configs.recommended;
const SONAR_RULES_DROPPED_FROM_RECOMMENDED = new Set([
  // Duplicates ESLint's built-in `max-lines` rule. Consumers get cleaner
  // skip-blanks/skip-comments semantics from the built-in; keeping both
  // double-reports the same finding with slightly different counts.
  "sonarjs/max-lines",
  // Inline work-in-progress markers are how agents and humans flag
  // known-incomplete work next to the code that needs it. SonarJS
  // treats every such marker as an error, which is noise for an
  // agent-targeted plugin where the markers are the calibration
  // signal we want preserved.
  "sonarjs/todo-tag",
  "sonarjs/fixme-tag",
]);
const sonarRecommendedRules = Object.fromEntries(
  Object.entries(sonarRecommendedConfig.rules ?? {}).filter(
    (entry): entry is [string, TSESLint.Linter.RuleEntry] =>
      entry[1] !== undefined && !SONAR_RULES_DROPPED_FROM_RECOMMENDED.has(entry[0]),
  ),
);

const strictComplexityRuleEntries: Record<string, TSESLint.Linter.RuleEntry> = {
  complexity: ["error", { max: 8 }],
  "agent-code-guard/max-non-trivial-classes-per-file": ["error", { max: 1 }],
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
      plugins: {
        "agent-code-guard": null!,
        jsdoc,
        sonarjs,
      },
      rules: {
        ...sonarRecommendedRules,
        ...jsdocRecommendedRuleEntries,
        ...recommendedSyntaxRuleEntries,
        ...recommendedArchitectureRuleEntries,
      },
      settings: sonarRecommendedConfig.settings,
    },
    strict: {
      plugins: {
        "agent-code-guard": null!,
        jsdoc,
        sonarjs,
      },
      rules: {
        ...sonarRecommendedRules,
        ...jsdocStrictRuleEntries,
        ...recommendedSyntaxRuleEntries,
        ...recommendedArchitectureRuleEntries,
        ...strictComplexityRuleEntries,
      },
      settings: sonarRecommendedConfig.settings,
    },
    integrationTests: {
      plugins: { "agent-code-guard": null! },
      rules: integrationTestRuleEntries,
    },
    architecture: {
      plugins: { "agent-code-guard": null! },
      rules: architecturePresetRuleEntries,
    },
    documentation: {
      plugins: { "agent-code-guard": null!, jsdoc },
      rules: documentationPresetRuleEntries,
    },
  },
};

plugin.configs.recommended.plugins["agent-code-guard"] = plugin;
plugin.configs.strict.plugins["agent-code-guard"] = plugin;
plugin.configs.integrationTests.plugins["agent-code-guard"] = plugin;
plugin.configs.architecture.plugins["agent-code-guard"] = plugin;
plugin.configs.documentation.plugins["agent-code-guard"] = plugin;

export default plugin;
