import { plugin as guard } from "eslint-plugin-agent-code-guard";

const HANDWRITTEN_TS = ["**/*.{ts,tsx,mts,cts}"];
const POLICY_IGNORES = ["node_modules/**", "dist/**", "coverage/**", "bench/fixtures/**", ".stryker-tmp/**"];

export default [
  // Apply the package policy consistently to every handwritten TypeScript file.
  {
    ...guard.configs.strict,
    files: HANDWRITTEN_TS,
    ignores: POLICY_IGNORES,
    languageOptions: {
      ...guard.configs.strict.languageOptions,
      parserOptions: {
        ...guard.configs.strict.languageOptions.parserOptions,
        projectService: {
          allowDefaultProject: [
            "bench/*.{ts,tsx,mts,cts}",
            "scripts/*.{ts,tsx,mts,cts}",
            "*.{ts,tsx,mts,cts}",
          ],
          defaultProject: "tsconfig.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Unit tests retain their test project and test-specific rule relaxations.
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
    ignores: POLICY_IGNORES,
  },
];
