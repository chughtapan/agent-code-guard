import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

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
    rules: guard.configs.strict.rules,
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
      ...guard.configs.strict.rules,
      "agent-code-guard/async-keyword": "off",
      "agent-code-guard/no-hardcoded-assertion-literals": "off",
    },
  },

  // Block 3: facade files — require full JSDoc on every public export.
  {
    files: [
      "src/**/index.ts",
      "src/index.ts",
      "src/rules/registry.ts",
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
