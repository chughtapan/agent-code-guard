import * as fc from "fast-check";
import { afterEach, expect, it } from "vitest";
import {
  barrelExports,
  cleanupArchitectureFixtures,
  diagnosticMessages,
  diagnosticsByRule,
  diagnosticsFor,
  hasRule,
  makeProject,
  nodeModuleTypePackage,
  packageJsonWithDependency,
  packageJsonWithExports,
  ratioArb,
  segmentArb,
  sourceModuleFiles,
} from "../test-support/analyzer-fixtures.js";

afterEach(cleanupArchitectureFixtures);

it("Property: inventory barrels follow count and ratio thresholds", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 9 }),
      fc.integer({ min: 0, max: 9 }),
      fc.integer({ min: 1, max: 9 }),
      ratioArb,
      (eligibleCount, rawExportCount, minExportedSiblingModules, maxExportedSiblingRatio) => {
        const exportedCount = Math.min(rawExportCount, eligibleCount);
        const root = makeProject({
          "src/widgets/index.ts": barrelExports("src/widgets", exportedCount),
          ...sourceModuleFiles("src/widgets", eligibleCount),
          "src/widgets/ignored.test.ts": "export const ignored = true;\n",
        });
        const shouldFlag =
          exportedCount >= minExportedSiblingModules &&
          exportedCount / eligibleCount >= maxExportedSiblingRatio;

        expect(
          hasRule(
            diagnosticsFor(root, { minExportedSiblingModules, maxExportedSiblingRatio }),
            "no-inventory-barrel",
          ),
        ).toBe(shouldFlag);
      },
    ),
    { numRuns: 4 },
  );
});

it("flags internal and wildcard package exports", () => {
  const root = makeProject({
    "package.json": packageJsonWithExports({
      ".": "./dist/index.js",
      "./internal/*": "./dist/internal/*.js",
      "./utils": "./dist/utils/index.js",
    }),
  });

  expect(
    diagnosticMessages(root, {
      forbiddenSubpathSegments: ["internal", "utils"],
      allowedPublicSubpaths: [{ subpath: ".", reason: "test: primary entrypoint" }],
    }),
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining('export "./internal/*" exposes implementation path'),
      expect.stringContaining('export "./utils" exposes implementation path'),
      expect.stringContaining('export "./internal/*" is a wildcard public surface'),
    ]),
  );
});

it("flags public test helper and implementation-shaped package exports", () => {
  const root = makeProject({
    "package.json": packageJsonWithExports({
      ".": "./dist/index.js",
      "./test-utils": "./dist/test-utils/index.js",
      "./driver": "./dist/db/driver.js",
    }),
    "src/test-utils/index.ts": "export const testHelper = true;\n",
    "src/db/driver.ts": "export const driver = true;\n",
  });

  expect(
    diagnosticMessages(root, {
      implementationPathSegments: ["driver"],
      allowedPublicSubpaths: [{ subpath: ".", reason: "test: primary entrypoint" }],
      allowedTestPublicSubpaths: [
        { subpath: "./testing", reason: "test: dedicated testing subpath" },
      ],
    }),
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining('export "./test-utils" exposes test-only path'),
      expect.stringContaining('export "./driver" points at implementation-shaped path'),
    ]),
  );
});

it("allows explicitly public subpaths", () => {
  const root = makeProject({
    "package.json": packageJsonWithExports({
      ".": "./dist/index.js",
      "./cli": "./dist/cli.js",
      "./testing": "./dist/testing/index.js",
    }),
    "src/cli.ts": "export const cli = true;\n",
    "src/testing/index.ts": "export const testing = true;\n",
  });

  expect(
    diagnosticMessages(root, {
      forbiddenSubpathSegments: ["internal", "utils", "helpers", "private"],
      allowedPublicSubpaths: [
        { subpath: ".", reason: "test: primary entrypoint" },
        { subpath: "./cli", reason: "test: CLI invocation contract" },
        { subpath: "./testing", reason: "test: consumer test helpers" },
      ],
      allowedTestPublicSubpaths: [
        { subpath: "./testing", reason: "test: consumer test helpers" },
      ],
    }),
  ).not.toContainEqual(expect.stringContaining("package.json export"));
});

it("flags export-star public boundaries and uncurated public facades", () => {
  const root = makeProject({
    "src/index.ts": ['export * from "./a";', 'export { B } from "./b";'].join("\n"),
    "src/a.ts": "export const A = true;\n",
    "src/b.ts": "export const B = true;\n",
  });

  expect(diagnosticMessages(root)).toEqual(
    expect.arrayContaining([
      expect.stringContaining("uses 1 export-star boundary declaration"),
      expect.stringContaining("is a public facade"),
    ]),
  );
});

it("Property: public reexport fanout follows the configured budget", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 18 }),
      fc.integer({ min: 0, max: 18 }),
      (reexportCount, maxPublicReexports) => {
        const root = makeProject({
          "src/index.ts": barrelExports("src", reexportCount),
          ...sourceModuleFiles("src", reexportCount),
        });

        expect(
          diagnosticsByRule(root, "no-large-public-surface", {
            maxPublicExports: 100,
            maxPublicReexports,
          }).some((diagnostic) => diagnostic.message.includes("re-exports")),
        ).toBe(reexportCount > maxPublicReexports);
      },
    ),
    { numRuns: 8 },
  );
});

it("Property: public vendor type leaks follow the allowlist", () => {
  fc.assert(
    fc.property(segmentArb, fc.boolean(), (packageName, allowed) => {
      const typeName = "VendorShape";
      const root = makeProject({
        "package.json": packageJsonWithDependency(packageName),
        ...nodeModuleTypePackage(packageName, typeName),
        "src/index.ts": [
          `import type { ${typeName} } from "${packageName}";`,
          "export interface PublicShape {",
          `  readonly raw: ${typeName};`,
          "}",
        ].join("\n"),
      });

      expect(
        hasRule(
          diagnosticsFor(root, {
            publicTypePackages: allowed
              ? [{ package: packageName, reason: "test: explicitly allowed" }]
              : [],
          }),
          "no-public-vendor-type-leak",
        ),
      ).toBe(!allowed);
    }),
    { numRuns: 8 },
  );
});

it("flags infrastructure type leaks and non-owned public boundary types", () => {
  const root = makeProject({
    "package.json": packageJsonWithDependency("kysely"),
    ...nodeModuleTypePackage("kysely", "Kysely"),
    "src/index.ts": [
      'import type { Kysely } from "kysely";',
      "export interface PublicDb {",
      "  readonly raw: Kysely<{ readonly id: string }>;",
      "}",
    ].join("\n"),
  });

  expect(
    diagnosticMessages(root, {
      infrastructureTypePackages: [
        { package: "kysely", reason: "test: query builder is implementation choice" },
      ],
    }),
  ).toEqual(
    expect.arrayContaining([
      expect.stringContaining('export "PublicDb" references "kysely" types'),
      expect.stringContaining('references infrastructure package "kysely"'),
      expect.stringContaining('export "PublicDb" mentions "kysely" directly'),
    ]),
  );
});

it("allows public vendor types when the package is declared as public API", () => {
  const root = makeProject({
    "package.json": packageJsonWithDependency("openai"),
    ...nodeModuleTypePackage("openai", "ChatCompletion"),
    "src/index.ts": [
      'import type { ChatCompletion } from "openai";',
      "export interface ChatResult {",
      "  readonly raw: ChatCompletion;",
      "}",
    ].join("\n"),
  });

  expect(
    diagnosticsFor(root, {
      publicTypePackages: [{ package: "openai", reason: "test: explicitly allowed" }],
    }),
  ).not.toContainEqual(expect.objectContaining({ ruleId: "no-public-vendor-type-leak" }));
});

it("warns for Node built-in public types unless the package is Node-facing", () => {
  const root = makeProject({
    "src/index.ts": [
      'import type { Readable } from "node:stream";',
      "export interface StreamResult {",
      "  readonly body: Readable;",
      "}",
    ].join("\n"),
  });

  expect(diagnosticsFor(root)).toContainEqual(
    expect.objectContaining({ ruleId: "no-public-vendor-type-leak", severity: "warn" }),
  );
  expect(diagnosticsFor(root, { packageRuntime: "node" })).not.toContainEqual(
    expect.objectContaining({ ruleId: "no-public-vendor-type-leak" }),
  );
});
