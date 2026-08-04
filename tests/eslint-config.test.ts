import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eslint = new ESLint({ cwd: repositoryRoot });
const VERTICAL_ORGANIZATION_RULES = [
  "@typescript-eslint/adjacent-overload-signatures",
  "agent-code-guard/no-vacuous-jsdoc",
  "agent-code-guard/prefer-stepdown-function-order",
  "agent-code-guard/require-stable-file-shell",
  "import-x/first",
  "jsdoc/require-file-overview",
  "perfectionist/sort-export-attributes",
  "perfectionist/sort-exports",
  "perfectionist/sort-heritage-clauses",
  "perfectionist/sort-import-attributes",
  "perfectionist/sort-imports",
  "perfectionist/sort-named-exports",
  "perfectionist/sort-named-imports",
] as const;

const configFor = async (filePath: string) =>
  eslint.calculateConfigForFile(path.join(repositoryRoot, filePath));

describe("repository ESLint configuration", () => {
  it("applies strict policy and project-service defaults to handwritten TypeScript", async () => {
    const paths = [
      "src/index.ts",
      "bench/lint-bench.ts",
      "scripts/calibrate-vertical-organization.mts",
      "src/rules/vertical-organization/types.d.ts",
      "vitest.config.ts",
      "src/component.tsx",
      "src/module.mts",
      "src/module.cts",
    ];

    for (const filePath of paths) {
      const config = await configFor(filePath);
      expect(config.rules["agent-code-guard/require-stable-file-shell"]).toEqual([2]);
      expect(config.languageOptions.parserOptions).toMatchObject({
        projectService: {
          allowDefaultProject: [
            "bench/*.{ts,tsx,mts,cts}",
            "scripts/*.{ts,tsx,mts,cts}",
            "*.{ts,tsx,mts,cts}",
          ],
          defaultProject: "tsconfig.json",
        },
        tsconfigRootDir: repositoryRoot,
      });
    }
  });

  it("preserves the test TypeScript project and test-rule relaxations", async () => {
    for (const filePath of ["tests/rule-meta-docs.test.ts", "src/test-support/helpers.ts"]) {
      const config = await configFor(filePath);
      expect(config.languageOptions.parserOptions).toMatchObject({
        project: "./tsconfig.test.json",
        projectService: false,
        tsconfigRootDir: repositoryRoot,
      });
      expect(config.rules["agent-code-guard/async-keyword"]).toEqual([0]);
      expect(config.rules["agent-code-guard/no-hardcoded-assertion-literals"]).toEqual([0]);
    }
  });

  it("globally ignores only the approved generated and dependency paths", async () => {
    for (const filePath of [
      "node_modules/example/index.ts",
      "dist/index.ts",
      "coverage/index.ts",
      "bench/fixtures/generated.ts",
    ]) {
      expect(await configFor(filePath)).toBeUndefined();
    }
  });

  it("enables all vertical-organization rules in the strict repository policy", async () => {
    const config = await configFor("src/index.ts");
    for (const ruleId of VERTICAL_ORGANIZATION_RULES) {
      expect(config.rules[ruleId]).toEqual(expect.arrayContaining([2]));
    }
  });
});
