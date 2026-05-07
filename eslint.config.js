import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

// Public contract declaration for this package. ESLint plugins legitimately
// expose `@typescript-eslint/utils` (the rule contract) and `node` types
// (createRequire, node:fs, node:path) in their public surface — list them
// explicitly so no-public-vendor-type-leak can verify intent.
const ARCHITECTURE_OPTIONS = {
  publicTypePackages: ["@typescript-eslint/utils"],
  packageRuntime: "node",
};

const ARCHITECTURE_RULE_IDS = Object.keys(guard.configs.architecture.rules);

const recommendedRules = {
  ...guard.configs.recommended.rules,
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
    ignores: ["**/*.test.ts", "**/*.spec.ts", "dist/**", "node_modules/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: {
      "agent-code-guard": guard,
    },
    rules: recommendedRules,
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
      ...recommendedRules,
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
