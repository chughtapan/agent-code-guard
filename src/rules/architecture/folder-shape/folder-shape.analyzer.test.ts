import * as fc from "fast-check";
import { afterEach, expect, it } from "vitest";
import { folderDistance } from "../imports/folder-distance.js";
import {
  cleanupArchitectureFixtures,
  diagnosticsByRule,
  makeProject,
  segmentArb,
} from "../test-support/analyzer-fixtures.js";

afterEach(cleanupArchitectureFixtures);

it("Property: large folder diagnostics follow semantic and unpaired test budgets", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 5 }),
      fc.integer({ min: 0, max: 5 }),
      (productionCount, unpairedTestCount) => {
        const root = makeProject(folderSizeFiles(productionCount, unpairedTestCount));
        const diagnostics = diagnosticsByRule(root, "no-large-folder", {
          maxFolderChildren: 3,
          maxFolderChildrenIncludingTests: 6,
          maxUnpairedTestChildren: 2,
        });
        const testCount = productionCount + unpairedTestCount;
        expect(diagnostics.length > 0)
          .toBe(
            productionCount > 3 ||
            productionCount + testCount > 6 ||
            unpairedTestCount > 2,
          );
      },
    ),
    { numRuns: 24 },
  );
});

it("Property: flat test folders follow the including-tests budget", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 24 }),
      fc.integer({ min: 1, max: 20 }),
      (testCount, maxFolderChildrenIncludingTests) => {
        const root = makeProject({
          "tsconfig.json": fixtureTsconfig(["src/**/*", "tests/**/*"]),
          ...standaloneTestFiles(testCount),
        });
        const diagnostics = diagnosticsByRule(root, "no-large-folder", {
          maxFolderChildren: 10,
          maxFolderChildrenIncludingTests,
          maxUnpairedTestChildren: 24,
        });
        expect(diagnostics.length > 0).toBe(testCount > maxFolderChildrenIncludingTests);
      },
    ),
    { numRuns: 16 },
  );
});

it("lint tsconfig includes tests even when the production tsconfig excludes them", () => {
  const root = makeProject({
    "tsconfig.json": fixtureTsconfig(["src/**/*"], ["src/**/*.test.ts"]),
    "tsconfig.lint.json": fixtureTsconfig(["src/**/*"], []),
    ...unpairedTestFiles("src/rules", 4),
  });
  const options = {
    maxFolderChildren: 10,
    maxFolderChildrenIncludingTests: 3,
    maxUnpairedTestChildren: 10,
  };

  expect(diagnosticsByRule(root, "no-large-folder", options)).toHaveLength(0);
  expect(diagnosticsByRule(root, "no-large-folder", {
    ...options,
    tsconfigPath: "tsconfig.lint.json",
  }).length).toBeGreaterThan(0);
});

it("default folder child budgets are 10 production and 20 including tests", () => {
  expect(diagnosticsByRule(makeProject(folderSizeFiles(10, 0)), "no-large-folder"))
    .toHaveLength(0);
  expect(diagnosticsByRule(makeProject(folderSizeFiles(11, 0)), "no-large-folder").length)
    .toBeGreaterThan(0);
  expect(diagnosticsByRule(makeProject(folderSizeFiles(10, 1)), "no-large-folder").length)
    .toBeGreaterThan(0);
});

it("Property: folders over the README threshold require configured boundary docs", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 6 }),
      fc.integer({ min: 2, max: 6 }),
      fc.boolean(),
      fc.constantFrom("README.md", "ARCHITECTURE.md"),
      (productionCount, minFolderReadmeChildren, hasReadme, readmeName) => {
        const root = makeProject({
          ...folderSizeFiles(productionCount, 0),
          ...(hasReadme ? { [`src/rules/${readmeName}`]: "# Rules\n" } : {}),
        });
        const diagnostics = diagnosticsByRule(root, "folder-readme-required", {
          minFolderReadmeChildren,
          folderReadmeFileNames: [readmeName],
        });

        expect(diagnostics.length > 0)
          .toBe(productionCount >= minFolderReadmeChildren && !hasReadme);
      },
    ),
    { numRuns: 24 },
  );
});

it("Property: distant folder imports follow folder-hop budget", () => {
  fc.assert(
    fc.property(
      fc.array(segmentArb, { minLength: 1, maxLength: 4 }),
      fc.array(segmentArb, { minLength: 1, maxLength: 4 }),
      fc.integer({ min: 1, max: 6 }),
      (fromSegments, toSegments, maxFolderImportDistance) => {
        fc.pre(folderKey(fromSegments) !== folderKey(toSegments));
        const root = makeProject(distantImportFiles(fromSegments, toSegments));
        const diagnostics = diagnosticsByRule(root, "no-distant-folder-import", {
          maxFolderImportDistance,
        });
        const expectedDistance = folderDistance(
          folderKey(fromSegments),
          folderKey(toSegments),
        );
        expect(diagnostics.length > 0).toBe(expectedDistance > maxFolderImportDistance);
      },
    ),
    { numRuns: 16 },
  );
});

function folderSizeFiles(
  productionCount: number,
  unpairedTestCount: number,
): Record<string, string> {
  return {
    ...pairedProductionFiles(productionCount),
    ...unpairedTestFiles("src/rules", unpairedTestCount),
  };
}

function pairedProductionFiles(count: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      [`src/rules/case-${index}.ts`, `export const case${index} = true;\n`],
      [`src/rules/case-${index}.test.ts`, `export const case${index}Test = true;\n`],
    ]).flat(),
  );
}

function standaloneTestFiles(count: number): Record<string, string> {
  return {
    ...unpairedTestFiles("tests", count),
  };
}

function unpairedTestFiles(directory: string, count: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `${directory}/orphan-${index}.test.ts`,
      `export const orphan${index} = true;\n`,
    ]),
  );
}

function distantImportFiles(
  fromSegments: readonly string[],
  toSegments: readonly string[],
): Record<string, string> {
  return {
    [`src/${folderKey(fromSegments)}/index.ts`]: [
      `import { value } from "${relativeImport(fromSegments, toSegments)}";`,
      "export const own = value;",
    ].join("\n"),
    [`src/${folderKey(toSegments)}/index.ts`]: "export const value = true;\n",
  };
}

function relativeImport(
  fromSegments: readonly string[],
  toSegments: readonly string[],
): string {
  return `${"../".repeat(fromSegments.length)}${folderKey(toSegments)}/index`;
}

function folderKey(segments: readonly string[]): string {
  return segments.join("/");
}

function fixtureTsconfig(
  include: readonly string[],
  exclude: readonly string[] = [],
): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      rootDir: ".",
    },
    include,
    exclude,
  });
}
