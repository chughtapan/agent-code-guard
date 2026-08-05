/**
 * @file Verifies repository ESLint configuration and vertical-organization policy coverage by file class.
 */

import { ESLint } from "eslint";
import * as fc from "fast-check";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface ResolvedConfig {
  readonly languageOptions: { readonly parserOptions: unknown };
  readonly rules: Readonly<Record<string, unknown>>;
}

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

const HANDWRITTEN_TYPESCRIPT_PATHS = [
  "src/index.ts",
  "bench/lint-bench.ts",
  "scripts/calibrate-vertical-organization.mts",
  "src/rules/vertical-organization/types.d.ts",
  "vitest.config.ts",
  "src/component.tsx",
  "src/module.mts",
  "src/module.cts",
];

const TEST_PROJECT_PATHS = ["tests/rule-meta-docs.test.ts", "src/test-support/helpers.ts"];

const GLOBALLY_IGNORED_PATHS = [
  "node_modules/example/index.ts",
  "dist/index.ts",
  "coverage/index.ts",
  "bench/fixtures/generated.ts",
];

const PROJECT_SERVICE_PARSER_OPTIONS = {
  projectService: {
    allowDefaultProject: [
      "bench/*.{ts,tsx,mts,cts}",
      "scripts/*.{ts,tsx,mts,cts}",
      "*.{ts,tsx,mts,cts}",
    ],
    defaultProject: "tsconfig.json",
  },
  tsconfigRootDir: repositoryRoot,
};

const TEST_PROJECT_PARSER_OPTIONS = {
  project: "./tsconfig.test.json",
  projectService: false,
  tsconfigRootDir: repositoryRoot,
};

const handwrittenPathArbitrary = fc
  .tuple(
    fc.constantFrom("src", "src/rules/safety", "bench", "scripts", "tests", "src/test-support"),
    fc.constantFrom("index", "module", "helper", "types.d", "widget.test"),
    fc.constantFrom(".ts", ".tsx", ".mts", ".cts"),
  )
  .map(([directory, base, extension]) => `${directory}/${base}${extension}`);

async function expectStrictProjectDefaults(filePath: string) {
  const config = await configFor(filePath);
  expect(config.rules["agent-code-guard/require-stable-file-shell"]).toEqual([2]);
  expect(config.languageOptions.parserOptions).toMatchObject(PROJECT_SERVICE_PARSER_OPTIONS);
}

async function expectTestProjectRelaxations(filePath: string) {
  const config = await configFor(filePath);
  expect(config.languageOptions.parserOptions).toMatchObject(TEST_PROJECT_PARSER_OPTIONS);
  expect(config.rules["agent-code-guard/async-keyword"]).toEqual([0]);
  expect(config.rules["agent-code-guard/no-hardcoded-assertion-literals"]).toEqual([0]);
}

async function expectVerticalOrganizationRules(filePath: string) {
  const config = await configFor(filePath);
  for (const ruleId of VERTICAL_ORGANIZATION_RULES) {
    expect(config.rules[ruleId]).toEqual(expect.arrayContaining([2]));
  }
}

async function configFor(filePath: string) {
  const calculated = await rawConfigFor(filePath);
  if (!isResolvedConfig(calculated)) {
    throw new TypeError(`ESLint resolved no rules or languageOptions for ${filePath}`);
  }
  return calculated;
}

async function rawConfigFor(filePath: string) {
  const calculated: unknown = await eslint.calculateConfigForFile(
    path.join(repositoryRoot, filePath),
  );
  return calculated;
}

function isResolvedConfig(value: unknown): value is ResolvedConfig {
  if (!isPlainObject(value)) {
    return false;
  }
  const { languageOptions, rules } = value;
  if (!isPlainObject(rules) || !isPlainObject(languageOptions)) {
    return false;
  }
  return "parserOptions" in languageOptions;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

describe("repository ESLint configuration", () => {
  it("applies strict policy and project-service defaults to handwritten TypeScript", async () => {
    for (const filePath of HANDWRITTEN_TYPESCRIPT_PATHS) {
      await expectStrictProjectDefaults(filePath);
    }
  });

  it("preserves the test TypeScript project and test-rule relaxations", async () => {
    for (const filePath of TEST_PROJECT_PATHS) {
      await expectTestProjectRelaxations(filePath);
    }
  });

  it("globally ignores only the approved generated and dependency paths", async () => {
    for (const filePath of GLOBALLY_IGNORED_PATHS) {
      expect(await rawConfigFor(filePath)).toBeUndefined();
    }
  });

  it("enables all vertical-organization rules in the strict repository policy", async () => {
    await expectVerticalOrganizationRules("src/index.ts");
  });

  it("enables the vertical-organization rules for every handwritten path class", async () => {
    await fc.assert(
      fc.asyncProperty(handwrittenPathArbitrary, async (filePath) => {
        await expectVerticalOrganizationRules(filePath);
      }),
      { numRuns: 40 },
    );
  }, 30_000);
});
