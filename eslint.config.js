import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

const ARCHITECTURE_OPTIONS = {
  tsconfigPath: "tsconfig.lint.json",
  publicTypePackages: [
    {
      package: "@typescript-eslint/utils",
      reason: "this package is an ESLint plugin; the TSESLint rule contract is the public API",
    },
  ],
  packageRuntime: "node",
  sharedFolderNames: [
    {
      folder: "utils",
      reason: "shared helpers (create-rule, AST refinement) used by every individual rule",
    },
  ],
  facadeFiles: [
    {
      file: "rules/registry.ts",
      reason: "central plugin rule registry consumed by the public plugin entrypoint",
    },
    {
      file: "rules/architecture/plugin-rules.ts",
      reason: "architecture ESLint rule registry and preset surface",
    },
    {
      file: "rules/utils/create-rule.ts",
      reason: "ESLint rule factory imported by every rule file; deliberate flat facade so each rule reads as a single createRule call",
    },
    {
      file: "rules/utils/is-test-file.ts",
      reason: "small path-shaped predicate used by testing/safety rules to gate against test files; not worth wrapping in a folder",
    },
  ],
};

const ARCHITECTURE_RULE_IDS = Object.keys(guard.configs.architecture.rules);

const recommendedRules = {
  ...guard.configs.strict.rules,
  ...Object.fromEntries(
    ARCHITECTURE_RULE_IDS.map((id) => [
      id,
      [guard.configs.recommended.rules[id] ?? "error", ARCHITECTURE_OPTIONS],
    ]),
  ),
};

export default [
  // Block 1: plugin source.
  {
    files: ["src/**/*.ts"],
    ignores: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/test-support/**",
      "dist/**",
      "node_modules/**",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: guard.configs.strict.plugins,
    settings: guard.configs.strict.settings,
    rules: recommendedRules,
  },

  // Block 2: unit tests.
  {
    files: [
      "tests/**/*.ts",
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/test-support/**/*.ts",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: guard.configs.strict.plugins,
    settings: guard.configs.strict.settings,
    rules: {
      ...recommendedRules,
      "agent-code-guard/async-keyword": "off",
      "agent-code-guard/no-hardcoded-assertion-literals": "off",
    },
  },

  // Block 3: facade files — require full JSDoc on every public export.
  // Mirrors ARCHITECTURE_OPTIONS.facadeFiles plus every `index.ts` barrel.
  {
    files: [
      "src/**/index.ts",
      "src/index.ts",
      "src/rules/registry.ts",
      "src/rules/architecture/plugin-rules.ts",
      "src/rules/utils/create-rule.ts",
      "src/rules/utils/is-test-file.ts",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: guard.configs.documentation.plugins,
    rules: guard.configs.documentation.rules,
  },

  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
    ],
  },
];
