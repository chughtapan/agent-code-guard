import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as fc from "fast-check";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  exportDeclarationIsTypeOnly,
  exportedSiblingModuleKeys,
  eligibleSiblingModuleKeys,
  inventoryBarrelDiagnostic,
  isExcludedSourceFile,
  isIndexSourceFile,
  siblingModuleKeyFromSpecifier,
  sourceModuleKey,
} from "../src/topology/check-inventory-barrels.js";
import {
  checkPackageExports,
  packagePathSegments,
  packageReportPath,
  pathHasForbiddenSegment,
} from "../src/topology/check-package-exports.js";
import {
  checkPublicVendorTypeLeaks,
  externalReExportDiagnostics,
  normalizeTypePackageName,
  packageAllowedInPublicTypes,
  packageNameFromFileName,
  packageNameFromSpecifier,
} from "../src/topology/check-public-type-leaks.js";
import { clearTopologyCache } from "../src/topology/cache.js";
import { uniqueDiagnostics } from "../src/topology/diagnostics.js";
import { normalizeTopologyOptions } from "../src/topology/options.js";
import { collectExportsValue, collectPackageExportEntries } from "../src/topology/package-exports.js";
import { readPackageJson } from "../src/topology/package-json.js";
import {
  candidateSourcePaths,
  createProgram,
  findPackageReportFile,
  projectSourceFiles,
  publicApiSourceFiles,
  sourcePathForPackageTarget,
} from "../src/topology/source-program.js";
import {
  folderEdgeDensity,
  stronglyConnectedFolderComponents,
} from "../src/topology/check-folder-graph.js";
import {
  folderKeyForFile,
  isTestLikePath,
  resolveLocalSpecifier,
  topFolder,
} from "../src/topology/project-graph.js";
import {
  OUTPUT_EXTENSIONS,
  replaceKnownExtension,
  SOURCE_EXTENSIONS,
  stripKnownExtension,
  withTrailingSeparator,
} from "../src/topology/path-utils.js";
import type { PackageJson, TopologyDiagnostic } from "../src/topology/types.js";

const segmentArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/);
const packageSegmentArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/);
const scopedPackageArb = fc.tuple(packageSegmentArb, packageSegmentArb);
const sourceExtensionArb = fc.constantFrom(...SOURCE_EXTENSIONS);
const testOnlySegmentArb = fc.constantFrom(
  "test",
  "tests",
  "testing",
  "test-utils",
  "test-support",
  "fixtures",
  "__fixtures__",
  "__tests__",
);

function exportSourceFileFor(modules: readonly string[], typeOnly: boolean): ts.SourceFile {
  const keyword = typeOnly ? "export type" : "export";
  return ts.createSourceFile(
    "index.ts",
    modules.map((moduleName, index) => `${keyword} { M${index} } from "./${moduleName}";`).join("\n"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function writeSiblingModules(
  directory: string,
  eligibleCount: number,
  exportedCount: number,
): ts.SourceFile {
  fs.mkdirSync(directory, { recursive: true });
  const exportLines = Array.from(
    { length: exportedCount },
    (_, index) => `export { M${index} } from "./m${index}";`,
  );
  const indexPath = path.join(directory, "index.ts");
  fs.writeFileSync(indexPath, exportLines.join("\n"));

  for (let index = 0; index < eligibleCount; index += 1) {
    fs.writeFileSync(
      path.join(directory, `m${index}.ts`),
      `export const M${index} = ${index};\n`,
    );
  }

  fs.writeFileSync(path.join(directory, "ignored.test.ts"), "export const ignored = true;\n");
  return ts.createSourceFile(
    indexPath,
    exportLines.join("\n"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function packageJsonForExports(exportsValue: unknown): PackageJson {
  return {
    name: "pkg",
    exports: exportsValue,
    dependencies: new Map(),
    devDependencies: new Map(),
    peerDependencies: new Map(),
  };
}

function packageExportDiagnostics(
  exportsValue: unknown,
  options: Parameters<typeof normalizeTopologyOptions>[0] = {},
): readonly TopologyDiagnostic[] {
  return checkPackageExports(
    packageJsonForExports(exportsValue),
    normalizeTopologyOptions({ projectRoot: "/repo", ...options }),
    "/repo/package.json",
  );
}

function diagnosticsForRule(
  diagnostics: readonly TopologyDiagnostic[],
  ruleId: TopologyDiagnostic["ruleId"],
): readonly TopologyDiagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.ruleId === ruleId);
}

function programFromSourceFiles(sourceFiles: readonly ts.SourceFile[]): ts.Program {
  return {
    getSourceFiles: () => [...sourceFiles],
  } as ts.Program;
}

function writePublicTypeProject(
  packageName: string,
  publicSource: string,
  dependencyKind: "dependencies" | "devDependencies" | "peerDependencies" = "dependencies",
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-public-type-"));
  const files: Record<string, string> = {
    "package.json": JSON.stringify(
      {
        name: "fixture",
        version: "1.0.0",
        type: "module",
        [dependencyKind]: { [packageName]: "1.0.0" },
        exports: {
          ".": {
            import: "./dist/index.js",
            types: "./dist/index.d.ts",
          },
        },
      },
      null,
      2,
    ),
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          skipLibCheck: true,
          declaration: true,
          outDir: "./dist",
          rootDir: "./src",
        },
        include: ["src/**/*"],
      },
      null,
      2,
    ),
    "src/index.ts": publicSource,
    [`node_modules/${packageName}/package.json`]: JSON.stringify({
      name: packageName,
      version: "1.0.0",
      types: "index.d.ts",
    }),
    [`node_modules/${packageName}/index.d.ts`]:
      "export interface VendorShape<T = unknown> { readonly value: T; }\n",
  };

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }

  return root;
}

function publicTypeDiagnostics(
  root: string,
  options: Parameters<typeof normalizeTopologyOptions>[0] = {},
): readonly TopologyDiagnostic[] {
  const normalizedOptions = normalizeTopologyOptions({ projectRoot: root, ...options });
  const program = createProgram(normalizedOptions);
  return checkPublicVendorTypeLeaks(program, readPackageJson(root), normalizedOptions);
}

describe("topology helper units", () => {
  it("normalizes package exports including conditions, subpaths, arrays, and main/types fallback", () => {
    expect(
      collectExportsValue(
        {
          ".": { import: "./dist/index.js", types: "./dist/index.d.ts" },
          "./cli": ["./dist/cli.js", null],
          "./internal/*": { default: "./dist/internal/*.js" },
        },
        ".",
      ),
    ).toEqual([
      { publicPath: ".", targetPath: "./dist/index.js" },
      { publicPath: ".", targetPath: "./dist/index.d.ts" },
      { publicPath: "./cli", targetPath: "./dist/cli.js" },
      { publicPath: "./internal/*", targetPath: "./dist/internal/*.js" },
    ]);

    const packageJson: PackageJson = {
      name: "pkg",
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
      dependencies: new Map(),
      devDependencies: new Map(),
      peerDependencies: new Map(),
    };

    expect(collectPackageExportEntries(packageJson)).toEqual([
      { publicPath: ".", targetPath: "./dist/index.js" },
      { publicPath: ".", targetPath: "./dist/index.d.ts" },
    ]);
  });

  it("Property: package export flattening preserves every explicit public subpath target", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(segmentArb, { minLength: 1, maxLength: 8 }),
        (segments) => {
          const exportsObject = Object.fromEntries(
            segments.map((segment) => [
              `./${segment}`,
              {
                import: `./dist/${segment}.js`,
                types: `./dist/${segment}.d.ts`,
              },
            ]),
          );

          expect(collectExportsValue(exportsObject, ".")).toEqual(
            segments.flatMap((segment) => [
              { publicPath: `./${segment}`, targetPath: `./dist/${segment}.js` },
              { publicPath: `./${segment}`, targetPath: `./dist/${segment}.d.ts` },
            ]),
          );
        },
      ),
      { numRuns: 80 },
    );
  });

  it("Property: package export flattening ignores condition keys next to subpath keys", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(segmentArb, { minLength: 1, maxLength: 6 }),
        fc.constantFrom("import", "require", "types", "default"),
        (segments, conditionKey) => {
          const exportsObject = {
            [conditionKey]: "./dist/ignored-condition.js",
            ...Object.fromEntries(
              segments.map((segment) => [`./${segment}`, `./dist/${segment}.js`]),
            ),
          };

          expect(collectExportsValue(exportsObject, ".")).toEqual(
            segments.map((segment) => ({
              publicPath: `./${segment}`,
              targetPath: `./dist/${segment}.js`,
            })),
          );
        },
      ),
      { numRuns: 80 },
    );
  });

  it("uses the package root as the public path for string exports", () => {
    expect(
      collectExportsValue(
        {
          ".": "./dist/index.js",
          import: "./dist/ignored-condition.js",
        },
        ".",
      ),
    ).toEqual([{ publicPath: ".", targetPath: "./dist/index.js" }]);

    expect(
      collectPackageExportEntries(
        packageJsonForExports({
          ".": {
            import: "./dist/index.js",
            types: "./dist/index.d.ts",
          },
        }),
      ),
    ).toEqual([
      { publicPath: ".", targetPath: "./dist/index.js" },
      { publicPath: ".", targetPath: "./dist/index.d.ts" },
    ]);

    expect(collectPackageExportEntries(packageJsonForExports("./dist/index.js"))).toEqual([
      { publicPath: ".", targetPath: "./dist/index.js" },
    ]);
  });

  it("reads package.json into typed dependency maps without unsafe record casts", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-package-json-"));
    try {
      fs.writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify({
          name: "pkg",
          dependencies: { openai: "1.0.0", ignored: false },
          devDependencies: { vitest: "2.0.0" },
          peerDependencies: { react: "18.0.0" },
        }),
      );

      const packageJson = readPackageJson(root);
      expect(packageJson?.name).toBe("pkg");
      expect(packageJson?.dependencies.get("openai")).toBe("1.0.0");
      expect(packageJson?.dependencies.has("ignored")).toBe(false);
      expect(packageJson?.devDependencies.get("vitest")).toBe("2.0.0");
      expect(packageJson?.peerDependencies.get("react")).toBe("18.0.0");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("normalizes package export path segments before checking forbidden segments", () => {
    expect(packagePathSegments("./internal/*.js")).toEqual(["internal"]);
    expect(packagePathSegments("./...internal/**.js")).toEqual(["internal"]);
    expect(packagePathSegments("./dist\\utils\\index.js")).toEqual([
      "dist",
      "utils",
      "index",
    ]);
    expect(pathHasForbiddenSegment("./dist/helpers/index.js", ["helpers"])).toBe(true);
    expect(pathHasForbiddenSegment("./dist/public/index.js", ["helpers"])).toBe(false);
  });

  it("Property: forbidden path detection is segment-based after slash, wildcard, and extension normalization", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(segmentArb, { minLength: 1, maxLength: 5 }),
        segmentArb,
        (segments, forbidden) => {
          const cleanSegments = segments.filter((segment) => segment !== forbidden);
          const absentPath = `./${cleanSegments.join("/")}/index.js`;
          expect(pathHasForbiddenSegment(absentPath, [forbidden])).toBe(false);

          const presentPath = `./${[...cleanSegments, `${forbidden}*.js`].join("\\")}`;
          expect(pathHasForbiddenSegment(presentPath, [forbidden])).toBe(true);

          const dottedPresentPath = `./${cleanSegments.join("/")}/...${forbidden}/**.js`;
          expect(pathHasForbiddenSegment(dottedPresentPath, [forbidden])).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("Property: internal package export diagnostics fire for forbidden public or target path segments", () => {
    fc.assert(
      fc.property(
        segmentArb,
        segmentArb,
        fc.boolean(),
        (publicSegment, targetSegment, forbiddenOnPublicPath) => {
          const forbidden = "internal";
          const publicPath = forbiddenOnPublicPath
            ? `./${forbidden}/${publicSegment}`
            : `./${publicSegment}`;
          const targetPath = forbiddenOnPublicPath
            ? `./dist/${targetSegment}.js`
            : `./dist/${forbidden}/${targetSegment}.js`;
          const diagnostics = diagnosticsForRule(
            packageExportDiagnostics(
              { ".": "./dist/index.js", [publicPath]: targetPath },
              { forbiddenSubpathSegments: [forbidden] },
            ),
            "no-internal-subpath-export",
          );

          expect(diagnostics).toHaveLength(1);
          expect(diagnostics[0]?.message).toContain(publicPath);
          expect(diagnostics[0]?.message).toContain(targetPath);
          expect(diagnostics[0]?.message).toContain("curated entrypoints");
          expect(diagnostics[0]?.message).toContain("src/internal/utils/helpers");
        },
      ),
      { numRuns: 80 },
    );
  });

  it("Property: explicitly allowed public subpaths suppress internal export diagnostics", () => {
    fc.assert(
      fc.property(segmentArb, segmentArb, fc.boolean(), (publicSegment, targetSegment, onPublicPath) => {
        const forbidden = "internal";
        const publicPath = onPublicPath
          ? `./${forbidden}/${publicSegment}`
          : `./${publicSegment}`;
        const targetPath = onPublicPath
          ? `./dist/${targetSegment}.js`
          : `./dist/${forbidden}/${targetSegment}.js`;

        expect(
          diagnosticsForRule(
            packageExportDiagnostics(
              { ".": "./dist/index.js", [publicPath]: targetPath },
              {
                allowedPublicSubpaths: [publicPath],
                forbiddenSubpathSegments: [forbidden],
              },
            ),
            "no-internal-subpath-export",
          ),
        ).toEqual([]);
      }),
      { numRuns: 80 },
    );
  });

  it("Property: public subpath budget is inclusive up to the configured max", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        (subpathCount, maxSubpathExports) => {
          const exportsValue = Object.fromEntries([
            [".", "./dist/index.js"],
            ...Array.from({ length: subpathCount }, (_, index) => [
              `./p${index}`,
              `./dist/p${index}.js`,
            ] as const),
          ]);

          const budgetDiagnostics = diagnosticsForRule(
            packageExportDiagnostics(exportsValue, { maxSubpathExports }),
            "no-internal-subpath-export",
          ).filter((diagnostic) => diagnostic.message.includes("public subpaths"));

          if (subpathCount > maxSubpathExports) {
            expect(budgetDiagnostics).toHaveLength(1);
            expect(budgetDiagnostics[0]?.message).toContain(String(subpathCount));
            expect(budgetDiagnostics[0]?.message).toContain(String(maxSubpathExports));
            expect(budgetDiagnostics[0]?.message).toContain("filesystem");
          } else {
            expect(budgetDiagnostics).toEqual([]);
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it("Property: wildcard package export diagnostics follow the configured max", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 0, max: 6 }),
        (wildcardCount, maxWildcardExports) => {
          const exportsValue = Object.fromEntries([
            [".", "./dist/index.js"],
            ...Array.from({ length: wildcardCount }, (_, index) => [
              `./feature-${index}/*`,
              `./dist/feature-${index}/*.js`,
            ] as const),
          ]);

          const wildcardDiagnostics = packageExportDiagnostics(exportsValue, {
            maxSubpathExports: 100,
            maxWildcardExports,
            forbiddenSubpathSegments: [],
          }).filter((diagnostic) => diagnostic.message.includes("wildcard public surface"));

          expect(wildcardDiagnostics.length).toBe(
            wildcardCount > maxWildcardExports ? wildcardCount : 0,
          );
          for (const diagnostic of wildcardDiagnostics) {
            expect(diagnostic.message).toContain("*");
            expect(diagnostic.message).toContain("implementation files");
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it("Property: test helper public exports require explicit test subpath allowances", () => {
    fc.assert(
      fc.property(
        segmentArb,
        segmentArb,
        testOnlySegmentArb,
        fc.boolean(),
        (publicSegment, targetSegment, testSegment, onPublicPath) => {
          const publicPath = onPublicPath
            ? `./${testSegment}/${publicSegment}`
            : `./${publicSegment}`;
          const targetPath = onPublicPath
            ? `./dist/${targetSegment}.js`
            : `./dist/${testSegment}/${targetSegment}.js`;

          const diagnostics = diagnosticsForRule(
            packageExportDiagnostics(
              { ".": "./dist/index.js", [publicPath]: targetPath },
              {
                forbiddenSubpathSegments: [],
                implementationPathSegments: [],
                maxSubpathExports: 100,
              },
            ),
            "no-public-test-helper-leak",
          );

          expect(diagnostics).toHaveLength(1);
          expect(diagnostics[0]?.message).toContain(publicPath);
          expect(diagnostics[0]?.message).toContain(targetPath);
          expect(diagnostics[0]?.message).toContain("test-only path");
          expect(diagnostics[0]?.message).toContain("production API");

          expect(
            diagnosticsForRule(
              packageExportDiagnostics(
                { ".": "./dist/index.js", [publicPath]: targetPath },
                {
                  allowedTestPublicSubpaths: [publicPath],
                  forbiddenSubpathSegments: [],
                  implementationPathSegments: [],
                  maxSubpathExports: 100,
                },
              ),
              "no-public-test-helper-leak",
            ),
          ).toEqual([]);
        },
      ),
      { numRuns: 80 },
    );
  });

  it("Property: implementation-shaped public entries flag public or target path leaks", () => {
    fc.assert(
      fc.property(
        segmentArb,
        segmentArb,
        fc.boolean(),
        (publicSegment, targetSegment, onPublicPath) => {
          const implementationSegment = "driver";
          const publicPath = onPublicPath
            ? `./${implementationSegment}/${publicSegment}`
            : `./${publicSegment}`;
          const targetPath = onPublicPath
            ? `./dist/${targetSegment}.js`
            : `./dist/${implementationSegment}/${targetSegment}.js`;
          const options = {
            forbiddenSubpathSegments: [],
            implementationPathSegments: [implementationSegment],
            maxSubpathExports: 100,
          };
          const diagnostics = diagnosticsForRule(
            packageExportDiagnostics(
              { ".": "./dist/index.js", [publicPath]: targetPath },
              options,
            ),
            "no-implementation-file-public-entry",
          );

          expect(diagnostics).toHaveLength(1);
          expect(diagnostics[0]?.message).toContain(publicPath);
          expect(diagnostics[0]?.message).toContain(targetPath);
          expect(diagnostics[0]?.message).toContain("contract");

          expect(
            diagnosticsForRule(
              packageExportDiagnostics(
                { ".": "./dist/index.js", [publicPath]: targetPath },
                { ...options, allowedPublicSubpaths: [publicPath] },
              ),
              "no-implementation-file-public-entry",
            ),
          ).toEqual([]);
        },
      ),
      { numRuns: 80 },
    );
  });

  it("uses the package root when reporting package.json diagnostics", () => {
    const root = path.resolve("/repo");
    expect(packageReportPath(root)).toBe(path.join(root, "package.json"));
  });

  it("maps source and output extensions deterministically", () => {
    expect(stripKnownExtension("foo.ts")).toBe("foo");
    expect(stripKnownExtension("foo.mjs")).toBe("foo");
    expect(stripKnownExtension("foo.css")).toBe("foo.css");
    expect(replaceKnownExtension("dist/index.d.ts", ".ts")).toBe("dist/index.ts");
    expect(replaceKnownExtension("dist/index.js", ".tsx")).toBe("dist/index.tsx");
    expect(replaceKnownExtension("dist/no-extension", ".ts")).toBe("dist/no-extension.ts");
    expect(withTrailingSeparator("/tmp/demo")).toBe(`/tmp/demo${path.sep}`);
    expect(withTrailingSeparator(`/tmp/demo${path.sep}`)).toBe(`/tmp/demo${path.sep}`);
  });

  it("Property: known extension replacement removes exactly one terminal known extension", () => {
    fc.assert(
      fc.property(
        fc.array(segmentArb, { minLength: 1, maxLength: 4 }),
        fc.constantFrom(...SOURCE_EXTENSIONS, ...OUTPUT_EXTENSIONS, ".d.ts"),
        fc.constantFrom(...SOURCE_EXTENSIONS),
        (segments, currentExtension, nextExtension) => {
          const basePath = segments.join("/");
          expect(stripKnownExtension(`${basePath}${currentExtension}`)).toBe(
            basePath,
          );
          expect(replaceKnownExtension(`${basePath}${currentExtension}`, nextExtension)).toBe(
            `${basePath}${nextExtension}`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("recognizes eligible sibling source modules and exported sibling specifiers", () => {
    expect(sourceModuleKey("feature.ts")).toBe("feature");
    expect(sourceModuleKey("feature.test.ts")).toBeNull();
    expect(sourceModuleKey("feature.generated.ts")).toBeNull();
    expect(isExcludedSourceFile("index.ts")).toBe(true);
    expect(siblingModuleKeyFromSpecifier("./feature")).toBe("feature");
    expect(siblingModuleKeyFromSpecifier("./feature/index.js")).toBe("feature");
    expect(siblingModuleKeyFromSpecifier("../feature")).toBeNull();
    expect(siblingModuleKeyFromSpecifier("./nested/deeper")).toBeNull();

    const sourceFile = ts.createSourceFile(
      "index.ts",
      [
        'export type { A } from "./a";',
        'export { B } from "./b";',
        'export * from "./nested/index";',
      ].join("\n"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const firstExport = sourceFile.statements[0];
    expect(ts.isExportDeclaration(firstExport)).toBe(true);
    expect(exportDeclarationIsTypeOnly(firstExport as ts.ExportDeclaration)).toBe(true);
    expect(exportedSiblingModuleKeys(sourceFile, { countTypeOnlyExports: true })).toEqual(
      new Set(["a", "b", "nested"]),
    );
    expect(exportedSiblingModuleKeys(sourceFile, { countTypeOnlyExports: false })).toEqual(
      new Set(["b", "nested"]),
    );
  });

  it("Property: only index source files are treated as boundary barrels", () => {
    fc.assert(
      fc.property(segmentArb, sourceExtensionArb, (name, extension) => {
        const fileName = `${name}${extension}`;
        expect(isIndexSourceFile(fileName)).toBe(name === "index");
      }),
      { numRuns: 100 },
    );
  });

  it("Property: sibling export collection follows module specifiers and type-only options", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(segmentArb, { minLength: 1, maxLength: 8 }),
        (modules) => {
          const runtimeExports = exportSourceFileFor(modules, false);
          const typeExports = exportSourceFileFor(modules, true);
          const expected = new Set(modules);

          for (const moduleName of modules) {
            expect(siblingModuleKeyFromSpecifier(`./${moduleName}`)).toBe(moduleName);
            expect(siblingModuleKeyFromSpecifier(`./${moduleName}/index.js`)).toBe(moduleName);
          }

          expect(exportedSiblingModuleKeys(runtimeExports, { countTypeOnlyExports: true }))
            .toEqual(expected);
          expect(exportedSiblingModuleKeys(runtimeExports, { countTypeOnlyExports: false }))
            .toEqual(expected);
          expect(exportedSiblingModuleKeys(typeExports, { countTypeOnlyExports: true }))
            .toEqual(expected);
          expect(exportedSiblingModuleKeys(typeExports, { countTypeOnlyExports: false }))
            .toEqual(new Set());
        },
      ),
      { numRuns: 80 },
    );
  });

  it("distinguishes mixed type-only export clauses from fully type-only clauses", () => {
    const sourceFile = ts.createSourceFile(
      "index.ts",
      [
        'export { type A, B } from "./mixed";',
        'export { type C, type D } from "./types";',
      ].join("\n"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const [mixedExport, typeOnlyExport] = sourceFile.statements;
    expect(ts.isExportDeclaration(mixedExport)).toBe(true);
    expect(ts.isExportDeclaration(typeOnlyExport)).toBe(true);
    expect(exportDeclarationIsTypeOnly(mixedExport as ts.ExportDeclaration)).toBe(false);
    expect(exportDeclarationIsTypeOnly(typeOnlyExport as ts.ExportDeclaration)).toBe(true);
  });

  it("Property: inventory barrel diagnostics follow count and ratio thresholds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 1, max: 12 }),
        fc.constantFrom(0, 0.25, 0.5, 0.6, 0.75, 1),
        (eligibleCount, rawExportedCount, minExportedSiblingModules, maxExportedSiblingRatio) => {
          const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-inventory-property-"));
          try {
            const exportedCount = Math.min(rawExportedCount, eligibleCount);
            const sourceFile = writeSiblingModules(
              path.join(root, "src", "widgets"),
              eligibleCount,
              exportedCount,
            );
            const shouldFlag =
              exportedCount >= minExportedSiblingModules &&
              exportedCount / eligibleCount >= maxExportedSiblingRatio;

            expect(
              inventoryBarrelDiagnostic(
                sourceFile,
                normalizeTopologyOptions({
                  projectRoot: root,
                  minExportedSiblingModules,
                  maxExportedSiblingRatio,
                }),
              ).length > 0,
            ).toBe(shouldFlag);
          } finally {
            fs.rmSync(root, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it("Property: inventory barrel ratio is inclusive at the exact configured boundary", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 12 }),
        (eligibleCount, rawExportedCount) => {
          const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-inventory-ratio-"));
          try {
            const exportedCount = Math.min(rawExportedCount, eligibleCount);
            const sourceFile = writeSiblingModules(
              path.join(root, "src", "widgets"),
              eligibleCount,
              exportedCount,
            );

            expect(
              inventoryBarrelDiagnostic(
                sourceFile,
                normalizeTopologyOptions({
                  projectRoot: root,
                  minExportedSiblingModules: exportedCount,
                  maxExportedSiblingRatio: exportedCount / eligibleCount,
                }),
              ).length > 0,
            ).toBe(true);
          } finally {
            fs.rmSync(root, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it("Property: inventory barrels count only exported siblings that exist as eligible modules", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 8 }),
        (eligibleCount, extraExportCount) => {
          const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-inventory-intersect-"));
          try {
            const directory = path.join(root, "src", "widgets");
            fs.mkdirSync(directory, { recursive: true });
            const eligibleExports = Array.from(
              { length: eligibleCount },
              (_, index) => `export { M${index} } from "./m${index}";`,
            );
            const extraExports = Array.from(
              { length: extraExportCount },
              (_, index) => `export { Ghost${index} } from "./ghost${index}";`,
            );
            const indexPath = path.join(directory, "index.ts");
            const sourceText = [...eligibleExports, ...extraExports].join("\n");
            fs.writeFileSync(indexPath, sourceText);

            for (let index = 0; index < eligibleCount; index += 1) {
              fs.writeFileSync(
                path.join(directory, `m${index}.ts`),
                `export const M${index} = ${index};\n`,
              );
            }

            const sourceFile = ts.createSourceFile(
              indexPath,
              sourceText,
              ts.ScriptTarget.Latest,
              true,
              ts.ScriptKind.TS,
            );

            expect(
              inventoryBarrelDiagnostic(
                sourceFile,
                normalizeTopologyOptions({
                  projectRoot: root,
                  minExportedSiblingModules: eligibleCount + 1,
                  maxExportedSiblingRatio: 0,
                }),
              ),
            ).toEqual([]);
          } finally {
            fs.rmSync(root, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 60 },
    );
  });

  it("collects eligible sibling module keys from source files and indexed folders only", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-eligible-siblings-"));
    try {
      fs.writeFileSync(path.join(root, "feature.ts"), "export const feature = true;\n");
      fs.writeFileSync(path.join(root, ".hidden.ts"), "export const hidden = true;\n");
      fs.writeFileSync(path.join(root, "feature.test.ts"), "export const testOnly = true;\n");
      fs.mkdirSync(path.join(root, "foldered"), { recursive: true });
      fs.writeFileSync(path.join(root, "foldered", "index.ts"), "export const foldered = true;\n");
      fs.mkdirSync(path.join(root, "not-module"), { recursive: true });
      fs.writeFileSync(path.join(root, "not-module", "value.ts"), "export const value = true;\n");

      expect(eligibleSiblingModuleKeys(root)).toEqual(new Set(["feature", "foldered"]));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("maps package targets back to candidate source paths", () => {
    const root = path.resolve("/repo");
    expect(candidateSourcePaths("dist/index.js", root)).toEqual([
      path.resolve(root, "dist/index.ts"),
      path.resolve(root, "dist/index.tsx"),
      path.resolve(root, "dist/index.mts"),
      path.resolve(root, "dist/index.cts"),
      path.resolve(root, "src/index.ts"),
      path.resolve(root, "src/index.tsx"),
      path.resolve(root, "src/index.mts"),
      path.resolve(root, "src/index.cts"),
    ]);

    const sourceFile = ts.createSourceFile(
      path.resolve(root, "src/index.ts"),
      "export const ok = true;",
      ts.ScriptTarget.Latest,
    );
    const sourceFiles = new Map([[path.resolve(root, "src/index.ts"), sourceFile]]);
    expect(sourcePathForPackageTarget("./dist/index.js", root, sourceFiles)).toBe(
      path.resolve(root, "src/index.ts"),
    );
    expect(sourcePathForPackageTarget("dist/index.js", root, sourceFiles)).toBe(
      path.resolve(root, "src/index.ts"),
    );
    expect(sourcePathForPackageTarget(".\\dist\\index.js", root, sourceFiles)).toBe(
      path.resolve(root, "src/index.ts"),
    );
    expect(sourcePathForPackageTarget("./dist/missing.js", root, sourceFiles)).toBeNull();
  });

  it("Property: package target candidates map dist outputs back to source roots", () => {
    fc.assert(
      fc.property(
        fc.array(segmentArb, { minLength: 1, maxLength: 4 }),
        fc.boolean(),
        (segments, fromDist) => {
          const root = path.resolve("/repo");
          const target = `${fromDist ? "dist/" : ""}${segments.join("/")}.js`;
          const expectedPrefixes = fromDist
            ? [target, `src/${segments.join("/")}.js`]
            : [target];

          expect(candidateSourcePaths(target, root)).toEqual(
            expectedPrefixes.flatMap((prefix) =>
              SOURCE_EXTENSIONS.map((extension) =>
                path.resolve(root, replaceKnownExtension(prefix, extension)),
              ),
            ),
          );
        },
      ),
      { numRuns: 80 },
    );
  });

  it("creates TypeScript programs only when configuration can be read and parsed", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-source-program-"));
    try {
      expect(createProgram(normalizeTopologyOptions({ projectRoot: root }))).toBeNull();
      expect(
        createProgram(
          normalizeTopologyOptions({
            projectRoot: root,
            tsconfigPath: "missing-tsconfig.json",
          }),
        ),
      ).toBeNull();

      fs.writeFileSync(path.join(root, "tsconfig.json"), "{ invalid json");
      expect(createProgram(normalizeTopologyOptions({ projectRoot: root }))).toBeNull();

      fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { module: "DefinitelyNotAModuleKind" } }),
      );
      expect(createProgram(normalizeTopologyOptions({ projectRoot: root }))).toBeNull();

      fs.mkdirSync(path.join(root, "src"), { recursive: true });
      fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = true;\n");
      fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
          },
          include: ["src/**/*"],
        }),
      );

      expect(createProgram(normalizeTopologyOptions({ projectRoot: root }))).not.toBeNull();
      expect(
        createProgram(
          normalizeTopologyOptions({
            projectRoot: path.dirname(root),
            tsconfigPath: path.join(path.basename(root), "tsconfig.json"),
          }),
        ),
      ).not.toBeNull();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("filters project source files to sorted non-declaration files inside the package root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-project-files-"));
    try {
      const fileNames = [
        path.join(root, "src", "z.ts"),
        path.join(root, "src", "a.ts"),
        path.join(root, "src", "types.d.ts"),
        path.join(root, "node_modules", "dep", "index.ts"),
      ];
      for (const fileName of fileNames) {
        fs.mkdirSync(path.dirname(fileName), { recursive: true });
        fs.writeFileSync(fileName, "export const value = true;\n");
      }

      const program = ts.createProgram(fileNames, {
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        target: ts.ScriptTarget.ES2022,
      });

      expect(projectSourceFiles(program, root).map((sourceFile) => sourceFile.fileName)).toEqual([
        path.join(root, "src", "a.ts"),
        path.join(root, "src", "z.ts"),
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("Property: package report file selection follows public entrypoint priority", () => {
    const priority = ["src/index.ts", "src/index.tsx", "index.ts", "index.tsx"];

    fc.assert(
      fc.property(fc.subarray(["src/index.ts", "src/index.tsx", "index.ts", "index.tsx"]), (present) => {
        const root = path.resolve("/repo");
        const sourceFiles = [
          ts.createSourceFile(
            path.resolve(root, "src/not-public.ts"),
            "export const internal = true;",
            ts.ScriptTarget.Latest,
          ),
          ...[...present].reverse().map((relativePath) =>
            ts.createSourceFile(
              path.resolve(root, relativePath),
              "export const ok = true;",
              ts.ScriptTarget.Latest,
            ),
          ),
        ];
        const expectedRelativePath = priority.find((relativePath) =>
          present.includes(relativePath),
        );

        expect(findPackageReportFile(sourceFiles, root)).toBe(
          expectedRelativePath
            ? path.resolve(root, expectedRelativePath)
            : path.resolve(root, "src/not-public.ts"),
        );
      }),
      { numRuns: 20 },
    );

    for (const relativePath of priority) {
      const root = path.resolve("/repo");
      const sourceFiles = [
        ts.createSourceFile(
          path.resolve(root, "src/not-public.ts"),
          "export const internal = true;",
          ts.ScriptTarget.Latest,
        ),
        ts.createSourceFile(
          path.resolve(root, relativePath),
          "export const ok = true;",
          ts.ScriptTarget.Latest,
        ),
      ];
      expect(findPackageReportFile(sourceFiles, root)).toBe(path.resolve(root, relativePath));
    }

    const fallback = ts.createSourceFile("/repo/src/other.ts", "export const ok = true;", ts.ScriptTarget.Latest);
    expect(findPackageReportFile([fallback], "/repo")).toBe(fallback.fileName);
    expect(findPackageReportFile([], "/repo")).toBe(path.join("/repo", "package.json"));
  });

  it("selects public API source files from package exports and falls back to conventional index files", () => {
    const root = path.resolve("/repo");
    const sourceFiles = ["src/index.ts", "src/cli.ts", "src/private.ts", "src/alt.tsx"].map(
      (relativePath) =>
        ts.createSourceFile(
          path.join(root, relativePath),
          "export const ok = true;\n",
          ts.ScriptTarget.Latest,
        ),
    );
    const program = programFromSourceFiles(sourceFiles);
    const options = normalizeTopologyOptions({ projectRoot: root });
    const packageJson = packageJsonForExports({
      ".": "./dist/index.js",
      "./cli": "./dist/cli.js",
      "./missing": "./dist/missing.js",
    });

    expect(
      publicApiSourceFiles(program, packageJson, options).map((sourceFile) =>
        path.relative(root, sourceFile.fileName).replaceAll("\\", "/"),
      ),
    ).toEqual(["src/index.ts", "src/cli.ts"]);

    expect(
      publicApiSourceFiles(
        program,
        packageJsonForExports({ "./cli": "./dist/cli.js" }),
        options,
      ).map((sourceFile) =>
        path.relative(root, sourceFile.fileName).replaceAll("\\", "/"),
      ),
    ).toEqual(["src/cli.ts"]);

    expect(
      publicApiSourceFiles(program, null, options).map((sourceFile) =>
        path.relative(root, sourceFile.fileName).replaceAll("\\", "/"),
      ),
    ).toEqual(["src/index.ts"]);

    const fallbackProgram = programFromSourceFiles([
      ts.createSourceFile(
        path.join(root, "src", "alt.tsx"),
        "export const ok = true;\n",
        ts.ScriptTarget.Latest,
      ),
    ]);

    expect(
      publicApiSourceFiles(fallbackProgram, null, options).map((sourceFile) =>
        path.relative(root, sourceFile.fileName).replaceAll("\\", "/"),
      ),
    ).toEqual([]);
  });

  it("Property: conventional public API fallback follows every index candidate", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("src/index.ts", "src/index.tsx", "index.ts", "index.tsx"),
        (relativePath) => {
          const root = path.resolve("/repo");
          const program = programFromSourceFiles([
            ts.createSourceFile(
              path.join(root, relativePath),
              "export const ok = true;\n",
              ts.ScriptTarget.Latest,
            ),
          ]);

          expect(
            publicApiSourceFiles(
              program,
              null,
              normalizeTopologyOptions({ projectRoot: root }),
            ).map((sourceFile) =>
              path.relative(root, sourceFile.fileName).replaceAll("\\", "/"),
            ),
          ).toEqual([relativePath]);
        },
      ),
      { numRuns: 20 },
    );
  });

  it("resolves local TypeScript sources from extensionless and ESM .js specifiers", () => {
    const root = path.resolve("/repo");
    const sourceFiles = new Map(
      [
        path.resolve(root, "src/a.ts"),
        path.resolve(root, "src/b/index.ts"),
      ].map((fileName) => [
        fileName,
        ts.createSourceFile(fileName, "export const ok = true;", ts.ScriptTarget.Latest),
      ]),
    );

    expect(resolveLocalSpecifier(path.resolve(root, "src/index.ts"), "./a", sourceFiles))
      .toBe(path.resolve(root, "src/a.ts"));
    expect(resolveLocalSpecifier(path.resolve(root, "src/index.ts"), "./a.js", sourceFiles))
      .toBe(path.resolve(root, "src/a.ts"));
    expect(resolveLocalSpecifier(path.resolve(root, "src/index.ts"), "./b", sourceFiles))
      .toBe(path.resolve(root, "src/b/index.ts"));
  });

  it("computes folder keys, top folders, test-like paths, and folder graph density", () => {
    const root = path.resolve("/repo");
    expect(folderKeyForFile(path.resolve(root, "src/index.ts"), root)).toBe(".");
    expect(folderKeyForFile(path.resolve(root, "src/domain/model.ts"), root)).toBe(
      "domain",
    );
    expect(topFolder("domain/payments")).toBe("domain");
    expect(isTestLikePath(path.resolve(root, "src/test-utils/index.ts"))).toBe(true);

    const edges = [
      { from: "a", to: "b", kind: "import" as const, files: ["/repo/src/a.ts"] },
      { from: "b", to: "a", kind: "import" as const, files: ["/repo/src/b.ts"] },
    ];
    expect(stronglyConnectedFolderComponents(edges)).toEqual([["a", "b"]]);
    expect(folderEdgeDensity(["a", "b"], edges)).toBe(1);
  });

  it("Property: acyclic folder chains do not produce strongly connected components", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(segmentArb, { minLength: 2, maxLength: 8 }),
        (segments) => {
          const edges = segments.slice(0, -1).map((segment, index) => ({
            from: segment,
            to: segments[index + 1] ?? segment,
            kind: "import" as const,
            files: [`/repo/src/${segment}/index.ts`],
          }));

          expect(stronglyConnectedFolderComponents(edges)).toEqual([]);
        },
      ),
      { numRuns: 80 },
    );
  });

  it("normalizes external type package names and public allowances", () => {
    expect(packageNameFromSpecifier("node:stream")).toBe("node");
    expect(packageNameFromSpecifier("@scope/pkg/subpath")).toBe("@scope/pkg");
    expect(packageNameFromSpecifier("./local")).toBeNull();
    expect(packageNameFromSpecifier("/absolute")).toBeNull();
    expect(packageNameFromSpecifier("")).toBeNull();
    expect(normalizeTypePackageName("@types/react")).toBe("react");
    expect(normalizeTypePackageName("@types/node")).toBe("node");
    expect(normalizeTypePackageName("@types/aws__lambda")).toBe("@aws/lambda");
    expect(normalizeTypePackageName("@types/aws__lambda__extra")).toBe(
      "aws__lambda__extra",
    );
    expect(normalizeTypePackageName("@types/prefix_aws__lambda")).toBe(
      "prefix_aws__lambda",
    );
    expect(packageNameFromFileName("/repo/node_modules/@types/react/index.d.ts")).toBe("react");
    expect(packageNameFromFileName("C:\\repo\\node_modules\\@types\\react\\index.d.ts"))
      .toBe("react");
    expect(packageNameFromFileName("/repo/node_modules/openai/index.d.ts")).toBe("openai");
    expect(packageNameFromFileName("/repo/node_modules/")).toBeNull();
    expect(packageNameFromFileName("/repo/node_modules/typescript/lib/lib.dom.d.ts")).toBeNull();
    expect(packageNameFromFileName("/repo/node_modules/typescript/lib/lib.dom.d.ts.map"))
      .toBe("typescript");
    expect(packageNameFromFileName("/repo/src/generated/client.ts")).toBe("generated-vendor");
    expect(packageNameFromFileName("/repo/src/mygenerated/client.ts")).toBeNull();
    expect(packageNameFromFileName("/repo/src/domain/model.ts")).toBeNull();
    expect(
      packageAllowedInPublicTypes("node", {
        packageRuntime: "node",
        publicTypePackages: [],
      }),
    ).toBe(true);
    expect(
      packageAllowedInPublicTypes("react", {
        packageRuntime: "universal",
        publicTypePackages: ["react"],
      }),
    ).toBe(true);
    expect(
      packageAllowedInPublicTypes("node", {
        packageRuntime: "universal",
        publicTypePackages: [],
      }),
    ).toBe(false);
    expect(
      packageAllowedInPublicTypes("openai", {
        packageRuntime: "node",
        publicTypePackages: [],
      }),
    ).toBe(false);
    expect(
      packageAllowedInPublicTypes("openai", {
        packageRuntime: "universal",
        publicTypePackages: [],
      }),
    ).toBe(false);
  });

  it("Property: external public re-export diagnostics follow ownership and allowlist policy", () => {
    fc.assert(
      fc.property(packageSegmentArb, fc.boolean(), (packageName, allowed) => {
        const specifier = `${packageName}/subpath`;
        const sourceFile = ts.createSourceFile(
          "/repo/src/index.ts",
          `export type { VendorShape } from "${specifier}";`,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS,
        );
        const diagnostics = externalReExportDiagnostics(
          sourceFile,
          normalizeTopologyOptions({
            projectRoot: "/repo",
            infrastructureTypePackages: [],
            publicTypePackages: allowed ? [packageName] : [],
          }),
        );

        if (allowed) {
          expect(diagnostics).toEqual([]);
        } else {
          expect(diagnostics).toEqual([
            expect.objectContaining({
              ruleId: "no-public-vendor-type-leak",
              file: sourceFile.fileName,
              severity: "error",
              message: expect.stringContaining(packageName),
            }),
          ]);
          expect(diagnostics[0]?.message).toContain(specifier);
          expect(diagnostics[0]?.message).toContain("domain-owned public types");
        }
      }),
      { numRuns: 40 },
    );

    const localSourceFile = ts.createSourceFile(
      "/repo/src/index.ts",
      ['export type { Local } from "./local";', 'export type { Absolute } from "/repo/local";'].join("\n"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(
      externalReExportDiagnostics(
        localSourceFile,
        normalizeTopologyOptions({ projectRoot: "/repo" }),
      ),
    ).toEqual([]);
  });

  it("reports infrastructure and Node public re-export policy separately", () => {
    const infraSourceFile = ts.createSourceFile(
      "/repo/src/index.ts",
      'export type { Kysely } from "kysely";',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(
      externalReExportDiagnostics(
        infraSourceFile,
        normalizeTopologyOptions({
          projectRoot: "/repo",
          infrastructureTypePackages: ["kysely"],
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        ruleId: "no-public-vendor-type-leak",
        severity: "error",
        message: expect.stringContaining("domain-owned public types"),
      }),
      expect.objectContaining({
        ruleId: "no-public-infra-type-leak",
        severity: "error",
        message: expect.stringContaining("package-owned ports or DTOs"),
      }),
    ]);

    const nodeSourceFile = ts.createSourceFile(
      "/repo/src/index.ts",
      'export type { Readable } from "node:stream";',
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(
      externalReExportDiagnostics(
        nodeSourceFile,
        normalizeTopologyOptions({ projectRoot: "/repo", packageRuntime: "universal" }),
      ),
    ).toEqual([
      expect.objectContaining({
        ruleId: "no-public-vendor-type-leak",
        severity: "warn",
      }),
    ]);
    expect(
      externalReExportDiagnostics(
        nodeSourceFile,
        normalizeTopologyOptions({ projectRoot: "/repo", packageRuntime: "node" }),
      ),
    ).toEqual([]);
  });

  it("Property: public signature diagnostics inspect properties, unions, generics, calls, and constructors", () => {
    fc.assert(
      fc.property(packageSegmentArb, (packageName) => {
        const root = writePublicTypeProject(
          packageName,
          [
            `import type { VendorShape } from "${packageName}";`,
            "export interface PublicProperties { readonly raw: VendorShape; }",
            "export type PublicUnion = { readonly own: string } | VendorShape;",
            "export interface PublicGeneric { readonly items: ReadonlyArray<VendorShape<string>>; }",
            "export interface PublicCallable { readonly run: (input: VendorShape) => VendorShape; }",
            "export interface PublicConstructable { readonly make: new (input: VendorShape) => VendorShape; }",
            "export const identity = (input: VendorShape): VendorShape => input;",
          ].join("\n"),
        );

        try {
          const vendorDiagnostics = diagnosticsForRule(
            publicTypeDiagnostics(root),
            "no-public-vendor-type-leak",
          );
          const messages = vendorDiagnostics.map((diagnostic) => diagnostic.message);
          const expectedExportNames = [
            "PublicProperties",
            "PublicUnion",
            "PublicGeneric",
            "PublicCallable",
            "PublicConstructable",
            "identity",
          ];

          const missingExportNames = expectedExportNames.filter(
            (exportName) =>
              !messages.some(
                (message) =>
                  message.includes(`export "${exportName}" references`) &&
                  message.includes(packageName) &&
                  message.includes("publicTypePackages"),
              ),
          );
          expect(missingExportNames).toEqual([]);
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      }),
      { numRuns: 3 },
    );
  });

  it("warns for peer dependency public types while dependencies and devDependencies are errors", () => {
    const source = [
      'import type { VendorShape } from "vendor-lib";',
      "export interface PublicShape { readonly raw: VendorShape; }",
    ].join("\n");
    const dependencyRoot = writePublicTypeProject("vendor-lib", source, "dependencies");
    const devDependencyRoot = writePublicTypeProject("vendor-lib", source, "devDependencies");
    const peerDependencyRoot = writePublicTypeProject("vendor-lib", source, "peerDependencies");

    try {
      expect(
        diagnosticsForRule(publicTypeDiagnostics(dependencyRoot), "no-public-vendor-type-leak")
          .map((diagnostic) => diagnostic.severity),
      ).toEqual(["error"]);
      expect(
        diagnosticsForRule(publicTypeDiagnostics(devDependencyRoot), "no-public-vendor-type-leak")
          .map((diagnostic) => diagnostic.severity),
      ).toEqual(["error"]);
      expect(
        diagnosticsForRule(publicTypeDiagnostics(peerDependencyRoot), "no-public-vendor-type-leak")
          .map((diagnostic) => diagnostic.severity),
      ).toEqual(["warn"]);
      expect(
        diagnosticsForRule(
          publicTypeDiagnostics(dependencyRoot, { publicTypePackages: ["vendor-lib"] }),
          "no-public-vendor-type-leak",
        ),
      ).toEqual([]);
    } finally {
      fs.rmSync(dependencyRoot, { recursive: true, force: true });
      fs.rmSync(devDependencyRoot, { recursive: true, force: true });
      fs.rmSync(peerDependencyRoot, { recursive: true, force: true });
    }
  });

  it("Property: package specifier and @types normalization preserve package identity", () => {
    fc.assert(
      fc.property(packageSegmentArb, scopedPackageArb, (plainPackage, [scope, name]) => {
        expect(packageNameFromSpecifier(`${plainPackage}/sub/path`)).toBe(plainPackage);
        expect(packageNameFromSpecifier(`@${scope}/${name}/sub/path`)).toBe(
          `@${scope}/${name}`,
        );
        expect(normalizeTypePackageName(`@types/${plainPackage}`)).toBe(plainPackage);
        expect(normalizeTypePackageName(`@types/${scope}__${name}`)).toBe(
          `@${scope}/${name}`,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("deduplicates diagnostics by rule, file, and message", () => {
    const diagnostic: TopologyDiagnostic = {
      ruleId: "no-inventory-barrel",
      file: "/repo/src/index.ts",
      severity: "warn",
      message: "same",
    };

    expect(uniqueDiagnostics([diagnostic, diagnostic])).toEqual([diagnostic]);
  });

  it("Property: diagnostic dedupe key is rule plus file plus message", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(segmentArb, { minLength: 1, maxLength: 6 }),
        (messages) => {
          const diagnostics: TopologyDiagnostic[] = messages.flatMap((message) => [
            {
              ruleId: "no-inventory-barrel",
              file: "/repo/src/index.ts",
              severity: "warn",
              message,
            },
            {
              ruleId: "no-inventory-barrel",
              file: "/repo/src/index.ts",
              severity: "error",
              message,
            },
          ]);

          expect(uniqueDiagnostics(diagnostics)).toHaveLength(messages.length);
        },
      ),
      { numRuns: 80 },
    );
  });

  it("normalizes options and clears the topology cache without retaining stale reports", () => {
    const root = path.resolve("/repo");
    expect(normalizeTopologyOptions({ projectRoot: root, tsconfigPath: "tsconfig.eslint.json" }))
      .toMatchObject({
        projectRoot: root,
        tsconfigPath: path.resolve(root, "tsconfig.eslint.json"),
        minExportedSiblingModules: 4,
        maxExportedSiblingRatio: 0.6,
      });

    expect(() => clearTopologyCache()).not.toThrow();
  });
});
