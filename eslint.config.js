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

  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
    ],
  },
];
