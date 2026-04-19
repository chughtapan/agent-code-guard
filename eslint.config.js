import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  // Block 1: plugin source.
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts", "dist/**", "node_modules/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: {
      "agent-code-guard": guard,
    },
    rules: {
      ...guard.configs.recommended.rules,
    },
  },

  // Block 2: unit tests.
  {
    files: ["tests/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: {
      "agent-code-guard": guard,
    },
    rules: {
      ...guard.configs.recommended.rules,
      "agent-code-guard/async-keyword": "off",
      "agent-code-guard/no-hardcoded-assertion-literals": "off",
    },
  },

  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
    ],
  },
];
