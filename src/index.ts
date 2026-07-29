/**
 * @file Plugin entry point. Assembles every rule family, composes the
 * presets (`recommended`, `strict`, `documentation`, `integrationTests`),
 * and bundles `eslint-plugin-sonarjs` and `eslint-plugin-jsdoc` so
 * consumers do not install them separately.
 */

import type { TSESLint } from "@typescript-eslint/utils";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import jsdoc from "eslint-plugin-jsdoc";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";
import packageJson from "../package.json" with { type: "json" };
import {
  integrationTestRuleEntries,
  recommendedSyntaxRuleEntries,
  syntaxRules,
} from "./rules/registry.js";
import {
  googleCoreRuleEntries,
  googleDirectiveCommentRuleEntries,
  googleImportRuleEntries,
} from "./rules/google-style/rule-entries.js";
import { googleTypeScriptRuleEntries } from "./rules/google-style/typescript-rule-entries.js";

const rules = {
  ...syntaxRules,
} as const;

const meta = {
  name: packageJson.name,
  version: packageJson.version,
};

interface PluginConfig {
  languageOptions?: TSESLint.FlatConfig.Config["languageOptions"];
  plugins: Record<string, unknown>;
  rules: Record<string, TSESLint.Linter.RuleEntry>;
  settings?: Record<string, unknown>;
}

interface AgentCodeGuardPlugin {
  meta: typeof meta;
  rules: typeof rules;
  configs: {
    recommended: PluginConfig;
    strict: PluginConfig;
    integrationTests: PluginConfig;
    documentation: PluginConfig;
  };
}

const jsdocLogicalRules = jsdoc.configs["flat/logical-typescript-error"].rules ?? {};
const jsdocContentsRules = jsdoc.configs["flat/contents-typescript-error"].rules ?? {};
const jsdocRequirementsRules = jsdoc.configs["flat/requirements-typescript-error"].rules ?? {};

const pickEnabled = (
  src: Record<string, TSESLint.Linter.RuleEntry | undefined>,
): Record<string, TSESLint.Linter.RuleEntry> =>
  Object.fromEntries(
    Object.entries(src).filter(
      (entry): entry is [string, TSESLint.Linter.RuleEntry] => entry[1] !== undefined,
    ),
  );

const jsdocRequireRuleForTopLevelExports: TSESLint.Linter.RuleEntry = [
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
      "ExportNamedDeclaration[declaration=null][specifiers.length>0]",
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

const documentationPresetRuleEntries: Record<string, TSESLint.Linter.RuleEntry> = {
  ...jsdocRecommendedRuleEntries,
  ...pickEnabled(jsdocRequirementsRules),
  "jsdoc/require-jsdoc": jsdocRequireRuleForTopLevelExports,
  "jsdoc/require-description": "error",
  "jsdoc/require-description-complete-sentence": "error",
  "jsdoc/require-hyphen-before-param-description": ["error", "never"],
  "jsdoc/match-description": "error",
  "jsdoc/no-bad-blocks": "error",
  "jsdoc/no-blank-block-descriptions": "error",
  "jsdoc/no-blank-blocks": "error",
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
  // TypeScript-ESTree exposes node kinds as enum-like string unions. SonarJS
  // misclassifies valid comparisons against AST_NODE_TYPES as unrelated enums.
  "sonarjs/different-types-comparison",
]);
const sonarRecommendedRules = Object.fromEntries(
  Object.entries(sonarRecommendedConfig.rules ?? {}).filter(
    (entry): entry is [string, TSESLint.Linter.RuleEntry] =>
      entry[1] !== undefined && !SONAR_RULES_DROPPED_FROM_RECOMMENDED.has(entry[0]),
  ),
);

const importXTypeScriptSettings = {
  "import-x/extensions": [".js", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".d.ts"],
  "import-x/parsers": {
    "@typescript-eslint/parser": [".ts", ".tsx", ".mts", ".cts", ".d.ts"],
  },
  "import-x/resolver-next": [createTypeScriptImportResolver({ alwaysTryTypes: true })],
};

const bundledSettings = {
  ...sonarRecommendedConfig.settings,
  ...importXTypeScriptSettings,
};

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

const typeAwareLanguageOptions: NonNullable<PluginConfig["languageOptions"]> = {
  ecmaVersion: 2022,
  parser: tseslint.parser,
  parserOptions: {
    projectService: true,
  },
  sourceType: "module",
};

const googleRuleEntries: Record<string, TSESLint.Linter.RuleEntry> = {
  ...googleCoreRuleEntries,
  ...googleTypeScriptRuleEntries,
  ...googleImportRuleEntries,
  ...googleDirectiveCommentRuleEntries,
};

const bundledPlugins = {
  "@eslint-community/eslint-comments": eslintComments,
  "@typescript-eslint": tseslint.plugin,
  "agent-code-guard": null,
  "import-x": importX,
  jsdoc,
  sonarjs,
};

/**
 * Agent Code Guard ESLint plugin, including every rule and flat preset.
 */
export const plugin: AgentCodeGuardPlugin = {
  meta,
  rules,
  configs: {
    recommended: {
      languageOptions: typeAwareLanguageOptions,
      plugins: bundledPlugins,
      rules: {
        ...sonarRecommendedRules,
        ...googleRuleEntries,
        ...documentationPresetRuleEntries,
        ...recommendedSyntaxRuleEntries,
      },
      settings: bundledSettings,
    },
    strict: {
      languageOptions: typeAwareLanguageOptions,
      plugins: bundledPlugins,
      rules: {
        ...sonarRecommendedRules,
        ...googleRuleEntries,
        ...documentationPresetRuleEntries,
        ...recommendedSyntaxRuleEntries,
        ...strictComplexityRuleEntries,
      },
      settings: bundledSettings,
    },
    integrationTests: {
      plugins: { "agent-code-guard": null },
      rules: integrationTestRuleEntries,
    },
    documentation: {
      plugins: { "agent-code-guard": null, jsdoc },
      rules: documentationPresetRuleEntries,
    },
  },
};

plugin.configs.recommended.plugins["agent-code-guard"] = plugin;
plugin.configs.strict.plugins["agent-code-guard"] = plugin;
plugin.configs.integrationTests.plugins["agent-code-guard"] = plugin;
plugin.configs.documentation.plugins["agent-code-guard"] = plugin;
