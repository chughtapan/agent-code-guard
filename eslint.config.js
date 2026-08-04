import { plugin as guard } from "eslint-plugin-agent-code-guard";

export default [
  // Block 1: plugin source.
  {
    ...guard.configs.strict,
    files: ["src/**/*.ts"],
    ignores: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/test-support/**",
      "dist/**",
      "node_modules/**",
    ],
  },

  // Block 2: unit tests.
  {
    ...guard.configs.strict,
    files: [
      "tests/**/*.ts",
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/test-support/**/*.ts",
    ],
    languageOptions: {
      ...guard.configs.strict.languageOptions,
      parserOptions: {
        project: "./tsconfig.test.json",
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...guard.configs.strict.rules,
      "agent-code-guard/async-keyword": "off",
      "agent-code-guard/no-hardcoded-assertion-literals": "off",
    },
  },

  // Vertical-organization rules deliberately parse and traverse whole programs.
  // Their small AST utilities are individually checked by focused tests, while
  // generic line/branch metrics obscure that parser-oriented structure.
  {
    files: ["src/rules/vertical-organization/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "off",
      "agent-code-guard/no-example-only-tests": "off",
      "agent-code-guard/prefer-optional-over-undefined-union": "off",
      "agent-code-guard/require-assertion-rationale": "off",
      "complexity": "off",
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-params": "off",
      "max-statements": "off",
      "no-nested-ternary": "off",
      "sonarjs/argument-type": "off",
      "sonarjs/cognitive-complexity": "off",
      "sonarjs/cyclomatic-complexity": "off",
      "sonarjs/expression-complexity": "off",
      "sonarjs/max-lines-per-function": "off",
      "sonarjs/no-misleading-array-reverse": "off",
      "sonarjs/no-nested-conditional": "off",
      "sonarjs/regex-complexity": "off",
      "sonarjs/slow-regex": "off",
      "sonarjs/too-many-break-or-continue-in-loop": "off",
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
