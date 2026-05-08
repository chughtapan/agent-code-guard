import fs from "node:fs";
import path from "node:path";
import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import * as fc from "fast-check";
import { afterEach, expect, it } from "vitest";
import plugin from "../../../index.js";
import {
  cleanupArchitectureFixtures,
  diagnosticsByRule,
  folderApiFixture,
  implicitBoundaryFixture,
  makeProject,
  segmentArb,
  sharedKernelCohesionFixture,
} from "../test-support/analyzer-fixtures.js";

afterEach(cleanupArchitectureFixtures);

it("surfaces architecture diagnostics through individual ESLint rules", () => {
  const root = makeInventoryProject();
  const messages = verifyRuleMessages(root, "agent-code-guard/no-inventory-barrel");

  expect(messages).toHaveLength(1);
  expect(messages[0]?.ruleId).toBe("agent-code-guard/no-inventory-barrel");
  expect(messages[0]?.message).toContain("This exports inventory");
});

it("infers the nearest package root when projectRoot is omitted", () => {
  const root = makeInventoryProject();
  const messages = verifyRuleMessages(root, "agent-code-guard/no-inventory-barrel");

  expect(messages).toHaveLength(1);
  expect(messages[0]?.message).toContain("This exports inventory");
});

it("architecture preset exposes individual architecture rules", () => {
  expect(plugin.configs.architecture.rules).toMatchObject({
    "agent-code-guard/no-inventory-barrel": "warn",
    "agent-code-guard/no-public-vendor-type-leak": "warn",
    "agent-code-guard/no-folder-cycle": "warn",
    "agent-code-guard/require-curated-public-facade": "warn",
    "agent-code-guard/folder-explicit-api-required": "warn",
    "agent-code-guard/file-implicit-boundary-module": "warn",
    "agent-code-guard/shared-kernel-cohesion": "warn",
    "agent-code-guard/no-large-folder": "warn",
    "agent-code-guard/folder-readme-required": "warn",
    "agent-code-guard/no-distant-folder-import": "warn",
  });
  expect(plugin.configs.architecture.rules).not.toHaveProperty(
    "agent-code-guard/architecture-boundaries",
  );
});

it("Property: folder API diagnostics follow outside concrete imports", () => {
  fc.assert(
    fc.property(
      fc.record({
        apiFolder: segmentArb,
        consumerFolder: segmentArb,
        concreteCount: fc.integer({ min: 2, max: 5 }),
        consumerCount: fc.integer({ min: 1, max: 3 }),
        hasFacade: fc.boolean(),
      }),
      (input) => {
        fc.pre(input.apiFolder !== "index" && input.apiFolder !== input.consumerFolder);
        const root = makeProject(folderApiFixture(input));

        expect(diagnosticsByRule(root, "folder-explicit-api-required").length > 0)
          .toBe(!input.hasFacade);
      },
    ),
    { numRuns: 20 },
  );
});

it("Property: implicit boundary diagnostics follow caller/helper topology", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 2, max: 4 }),
      fc.integer({ min: 2, max: 4 }),
      fc.boolean(),
      (callerCount, helperCount, explicitBoundaryName) => {
        const boundaryName = explicitBoundaryName ? "boundary-api" : "boundary";
        const root = makeProject(
          implicitBoundaryFixture(boundaryName, callerCount, helperCount),
        );
        const options = explicitBoundaryName
          ? {
            facadeFiles: [
              {
                file: `${boundaryName}.ts`,
                reason: "fixture intentionally declares this non-index boundary",
              },
            ],
          }
          : {};

        expect(diagnosticsByRule(root, "file-implicit-boundary-module", options).length > 0)
          .toBe(!explicitBoundaryName);
      },
    ),
    { numRuns: 16 },
  );
});

it("Property: shared-kernel cohesion follows export consumer overlap", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 6, max: 10 }),
      fc.integer({ min: 4, max: 6 }),
      fc.boolean(),
      (exportCount, consumerCount, cohesive) => {
        const root = makeProject(
          sharedKernelCohesionFixture(exportCount, consumerCount, cohesive),
        );

        expect(diagnosticsByRule(root, "shared-kernel-cohesion").length > 0)
          .toBe(!cohesive);
      },
    ),
    { numRuns: 16 },
  );
});

function makeInventoryProject(): string {
  return makeProject({
    "src/widgets/index.ts": [
      'export { A } from "./a";',
      'export { B } from "./b";',
      'export { C } from "./c";',
      'export { D } from "./d";',
    ].join("\n"),
    "src/widgets/a.ts": "export const A = 1;\n",
    "src/widgets/b.ts": "export const B = 1;\n",
    "src/widgets/c.ts": "export const C = 1;\n",
    "src/widgets/d.ts": "export const D = 1;\n",
    "src/widgets/e.ts": "export const E = 1;\n",
  });
}

function verifyRuleMessages(root: string, ruleId: string): Linter.LintMessage[] {
  const filename = path.join(root, "src", "widgets", "index.ts");
  const linter = new Linter({ cwd: root });
  return linter.verify(
    fs.readFileSync(filename, "utf8"),
    [
      {
        files: ["**/*.ts"],
        languageOptions: {
          parser: tsParser as Linter.Parser,
          parserOptions: { ecmaVersion: 2022, sourceType: "module" },
        },
        plugins: { "agent-code-guard": plugin },
        rules: {
          [ruleId]: ["error", { projectRoot: root }],
        },
      },
    ],
    { filename },
  );
}
