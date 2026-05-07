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
} from "../src/rules/architecture/check-inventory-barrels.js";
import {
  checkPackageExports,
  packagePathSegments,
  packageReportPath,
  pathHasForbiddenSegment,
} from "../src/rules/architecture/check-package-exports.js";
import {
  checkPublicVendorTypeLeaks,
  externalReExportDiagnostics,
  normalizeTypePackageName,
  packageAllowedInPublicTypes,
  packageNameFromFileName,
  packageNameFromSpecifier,
} from "../src/rules/architecture/check-public-type-leaks.js";
import { cachedProjectArchitecture, clearArchitectureCache } from "../src/rules/architecture/cache.js";
import { uniqueDiagnostics } from "../src/rules/architecture/diagnostics.js";
import { resolveArchitectureOptions } from "../src/rules/architecture/options.js";
import { collectExportsValue, collectPackageExportEntries } from "../src/rules/architecture/package-exports.js";
import { readPackageJson } from "../src/rules/architecture/package-json.js";
import {
  candidateSourcePaths,
  createProgram,
  findPackageReportFile,
  projectSourceFiles,
  publicApiSourceFiles,
  sourcePathForPackageTarget,
} from "../src/rules/architecture/source-program.js";
import {
  folderEdgeDensity,
  stronglyConnectedFolderComponents,
} from "../src/rules/architecture/check-folder-graph.js";
import {
  folderKeyForFile,
  isTestLikePath,
  resolveLocalSpecifier,
  topFolder,
} from "../src/rules/architecture/project-graph.js";
import {
  hasSourceExtension,
  OUTPUT_EXTENSIONS,
  replaceKnownExtension,
  SOURCE_EXTENSIONS,
  stripKnownExtension,
  withTrailingSeparator,
} from "../src/rules/architecture/path-utils.js";
import type { PackageJson, ArchitectureDiagnostic } from "../src/rules/architecture/types.js";

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
  options: Parameters<typeof resolveArchitectureOptions>[0] = {},
): readonly ArchitectureDiagnostic[] {
  return checkPackageExports(
    packageJsonForExports(exportsValue),
    resolveArchitectureOptions({ projectRoot: "/repo", ...options }),
    "/repo/package.json",
  );
}

function diagnosticsForRule(
  diagnostics: readonly ArchitectureDiagnostic[],
  ruleId: ArchitectureDiagnostic["ruleId"],
): readonly ArchitectureDiagnostic[] {
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

function writeNodePackage(root: string, packageName: string, declarations: string): void {
  const packageJsonPath = path.join(root, "node_modules", packageName, "package.json");
  const declarationPath = path.join(root, "node_modules", packageName, "index.d.ts");
  fs.mkdirSync(path.dirname(packageJsonPath), { recursive: true });
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({ name: packageName, version: "1.0.0", types: "index.d.ts" }),
  );
  fs.writeFileSync(declarationPath, declarations);
}

function publicTypeDiagnostics(
  root: string,
  options: Parameters<typeof resolveArchitectureOptions>[0] = {},
): readonly ArchitectureDiagnostic[] {
  const normalizedOptions = resolveArchitectureOptions({ projectRoot: root, ...options });
  const program = createProgram(normalizedOptions);
  return checkPublicVendorTypeLeaks(program, readPackageJson(root), normalizedOptions);
}

function nestedReadonlyObjectType(leafType: string, depth: number): string {
  return Array.from({ length: depth }).reduceRight(
    (inner, _unused, index) => `{ readonly step${index}: ${inner}; }`,
    leafType,
  );
}

describe("architecture helper units", () => {
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
      expect(readPackageJson(root)).toBeNull();

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

  it("documents why internal and test-only package exports are bad", () => {
    const internalDiagnostic = diagnosticsForRule(
      packageExportDiagnostics(
        { ".": "./dist/index.js", "./internal/client": "./dist/internal/client.js" },
        { forbiddenSubpathSegments: ["internal"] },
      ),
      "no-internal-subpath-export",
    )[0];
    expect(internalDiagnostic?.message).toBe(
      'package.json export "./internal/client" exposes implementation path ' +
        '"./dist/internal/client.js". Public exports should be curated entrypoints, ' +
        "not src/internal/utils/helpers.",
    );

    const testDiagnostic = diagnosticsForRule(
      packageExportDiagnostics(
        { ".": "./dist/index.js", "./fixture": "./dist/__fixtures__/fixture.js" },
        {
          forbiddenSubpathSegments: [],
          implementationPathSegments: [],
          maxSubpathExports: 100,
        },
      ),
      "no-public-test-helper-leak",
    )[0];
    expect(testDiagnostic?.message).toBe(
      'package.json export "./fixture" exposes test-only path ' +
        '"./dist/__fixtures__/fixture.js". Test helpers need an explicitly allowed testing ' +
        "subpath so consumers do not treat them as production API.",
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
                allowedPublicSubpaths: [{ subpath: publicPath, reason: "test fixture" }],
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
                  allowedTestPublicSubpaths: [{ subpath: publicPath, reason: "test fixture" }],
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
                { ...options, allowedPublicSubpaths: [{ subpath: publicPath, reason: "test fixture" }] },
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
    expect(hasSourceExtension("foo.ts")).toBe(true);
    expect(hasSourceExtension("foo.js")).toBe(false);
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

  it("Property: source extension detection only accepts terminal TypeScript source extensions", () => {
    fc.assert(
      fc.property(
        fc.array(segmentArb, { minLength: 1, maxLength: 4 }),
        sourceExtensionArb,
        fc.constantFrom(...OUTPUT_EXTENSIONS, ".css", ".json", ".txt"),
        (segments, sourceExtension, nonSourceExtension) => {
          const basePath = segments.join("/");
          expect(hasSourceExtension(`${basePath}${sourceExtension}`)).toBe(true);
          expect(hasSourceExtension(`${basePath}${nonSourceExtension}`)).toBe(false);
          expect(hasSourceExtension(`${basePath}${sourceExtension}.map`)).toBe(false);
        },
      ),
      { numRuns: 80 },
    );
  });

  it("recognizes eligible sibling source modules and exported sibling specifiers", () => {
    expect(sourceModuleKey("feature.ts")).toBe("feature");
    expect(sourceModuleKey("feature.txt")).toBeNull();
    expect(sourceModuleKey("feature.d.ts")).toBeNull();
    expect(sourceModuleKey("feature.test.ts")).toBeNull();
    expect(sourceModuleKey("feature.generated.ts")).toBeNull();
    expect(isExcludedSourceFile("index.ts")).toBe(true);
    expect(isExcludedSourceFile("feature.test.ts.extra")).toBe(false);
    expect(isExcludedSourceFile("feature.test.xts")).toBe(false);
    expect(isExcludedSourceFile("feature.generated.ts.extra")).toBe(false);
    expect(isExcludedSourceFile("feature.generated.xts")).toBe(false);
    expect(siblingModuleKeyFromSpecifier("./feature")).toBe("feature");
    expect(siblingModuleKeyFromSpecifier("./feature/index.js")).toBe("feature");
    expect(siblingModuleKeyFromSpecifier("./feature\\index.js")).toBe("feature");
    expect(siblingModuleKeyFromSpecifier("./feature//index.js")).toBe("feature");
    expect(siblingModuleKeyFromSpecifier("./index")).toBeNull();
    expect(siblingModuleKeyFromSpecifier("../feature")).toBeNull();
    expect(siblingModuleKeyFromSpecifier("./nested/deeper")).toBeNull();
    expect(siblingModuleKeyFromSpecifier("./nested/index/deeper")).toBeNull();

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
    expect(isIndexSourceFile("index.css")).toBe(false);
    expect(isIndexSourceFile("index.js.map")).toBe(false);

    fc.assert(
      fc.property(segmentArb, sourceExtensionArb, (name, extension) => {
        const fileName = `${name}${extension}`;
        expect(isIndexSourceFile(fileName)).toBe(name === "index");
      }),
      { numRuns: 100 },
    );

    fc.assert(
      fc.property(
        segmentArb,
        fc.constantFrom(".js.map", ".css", ".json", ".txt"),
        (name, extension) => {
          expect(isIndexSourceFile(`${name}${extension}`)).toBe(false);
        },
      ),
      { numRuns: 80 },
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

            const diagnostics = inventoryBarrelDiagnostic(
              sourceFile,
              resolveArchitectureOptions({
                projectRoot: root,
                minExportedSiblingModules,
                maxExportedSiblingRatio,
              }),
            );

            if (shouldFlag) {
              expect(diagnostics).toHaveLength(1);
              expect(diagnostics[0]?.message).toContain(
                path.relative(root, sourceFile.fileName),
              );
              expect(diagnostics[0]?.message).toContain(
                `${exportedCount} of ${eligibleCount}`,
              );
              expect(diagnostics[0]?.message).toContain(
                "This exports inventory, not an abstraction",
              );
              expect(diagnostics[0]?.message).toContain(
                "ports, factories, and stable types only",
              );
            } else {
              expect(diagnostics).toEqual([]);
            }
          } finally {
            fs.rmSync(root, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 80 },
    );
  });

  it("Property: inventory diagnostics only run on index files with eligible siblings", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 8 }),
        (eligibleCount, exportedCount) => {
          const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-inventory-boundary-"));
          try {
            const directory = path.join(root, "src", "widgets");
            const indexSourceFile = writeSiblingModules(
              directory,
              eligibleCount,
              Math.min(exportedCount, eligibleCount),
            );
            const nonIndexSourceFile = ts.createSourceFile(
              path.join(directory, "facade.ts"),
              indexSourceFile.text,
              ts.ScriptTarget.Latest,
              true,
              ts.ScriptKind.TS,
            );

            expect(
              inventoryBarrelDiagnostic(
                nonIndexSourceFile,
                resolveArchitectureOptions({
                  projectRoot: root,
                  minExportedSiblingModules: 1,
                  maxExportedSiblingRatio: 0,
                }),
              ),
            ).toEqual([]);

            fs.rmSync(directory, { recursive: true, force: true });
            fs.mkdirSync(directory, { recursive: true });
            const emptyIndexPath = path.join(directory, "index.ts");
            const emptyIndexText = 'export { Ghost } from "./ghost";';
            fs.writeFileSync(emptyIndexPath, emptyIndexText);
            const emptyIndexSourceFile = ts.createSourceFile(
              emptyIndexPath,
              emptyIndexText,
              ts.ScriptTarget.Latest,
              true,
              ts.ScriptKind.TS,
            );

            expect(
              inventoryBarrelDiagnostic(
                emptyIndexSourceFile,
                resolveArchitectureOptions({
                  projectRoot: root,
                  minExportedSiblingModules: 1,
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
                resolveArchitectureOptions({
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
                resolveArchitectureOptions({
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
      expect(createProgram(resolveArchitectureOptions({ projectRoot: root }))).toBeNull();
      expect(
        createProgram(
          resolveArchitectureOptions({
            projectRoot: root,
            tsconfigPath: "missing-tsconfig.json",
          }),
        ),
      ).toBeNull();

      fs.writeFileSync(path.join(root, "tsconfig.json"), "{ invalid json");
      expect(createProgram(resolveArchitectureOptions({ projectRoot: root }))).toBeNull();

      fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { module: "DefinitelyNotAModuleKind" } }),
      );
      expect(createProgram(resolveArchitectureOptions({ projectRoot: root }))).toBeNull();

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

      expect(createProgram(resolveArchitectureOptions({ projectRoot: root }))).not.toBeNull();
      expect(
        createProgram(
          resolveArchitectureOptions({
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
    const options = resolveArchitectureOptions({ projectRoot: root });
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
              resolveArchitectureOptions({ projectRoot: root }),
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
        publicTypePackages: [{ package: "react", reason: "test fixture" }],
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
          resolveArchitectureOptions({
            projectRoot: "/repo",
            infrastructureTypePackages: [],
            publicTypePackages: allowed ? [{ package: packageName, reason: "test: explicitly allowed" }] : [],
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
          expect(diagnostics[0]?.message).toContain("publicTypePackages");
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
        resolveArchitectureOptions({ projectRoot: "/repo" }),
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
        resolveArchitectureOptions({
          projectRoot: "/repo",
          infrastructureTypePackages: [{ package: "kysely", reason: "test fixture" }],
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
        message: expect.stringContaining(
          `Public API references infrastructure package "kysely"`,
        ),
      }),
    ]);
    expect(externalReExportDiagnostics(
      infraSourceFile,
      resolveArchitectureOptions({
        projectRoot: "/repo",
        infrastructureTypePackages: [{ package: "kysely", reason: "test fixture" }],
      }),
    )[1]?.message).toContain(
      "Database, logging, transport, and SDK implementation choices",
    );
    expect(externalReExportDiagnostics(
      infraSourceFile,
      resolveArchitectureOptions({
        projectRoot: "/repo",
        infrastructureTypePackages: [{ package: "kysely", reason: "test fixture" }],
      }),
    )[1]?.message).toContain("package-owned ports or DTOs");

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
        resolveArchitectureOptions({ projectRoot: "/repo", packageRuntime: "universal" }),
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
        resolveArchitectureOptions({ projectRoot: "/repo", packageRuntime: "node" }),
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
            `import type * as VendorNamespace from "${packageName}";`,
            "export interface PublicProperties { readonly raw: VendorShape; }",
            "export interface PublicNamespace { readonly raw: VendorNamespace.VendorShape; }",
            `export interface PublicImportType { readonly raw: import("${packageName}").VendorShape; }`,
            "export type PublicUnion = { readonly own: string } | VendorShape;",
            "export interface PublicGeneric { readonly items: ReadonlyArray<VendorShape<string>>; }",
            "export interface PublicCallable { readonly run: (input: VendorShape) => VendorShape; }",
            "export interface PublicParamOnly { readonly accept: (input: VendorShape) => void; }",
            "export interface PublicReturnOnly { readonly create: () => VendorShape; }",
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
            "PublicNamespace",
            "PublicImportType",
            "PublicUnion",
            "PublicGeneric",
            "PublicCallable",
            "PublicParamOnly",
            "PublicReturnOnly",
            "PublicConstructable",
            "identity",
          ];

          const missingExportNames = expectedExportNames.filter(
            (exportName) =>
              !messages.some(
                (message) =>
                  message.includes(`export "${exportName}" references`) &&
                  message.includes(packageName) &&
                  message.includes("types. Wrap vendor types behind domain-owned public types") &&
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

  it("limits public signature traversal depth while preserving exact-boundary leaks", () => {
    const root = writePublicTypeProject(
      "vendor-lib",
      [
        'import type { VendorShape } from "vendor-lib";',
        "type LocalBox<T> = { readonly boxed: T };",
        'import type { OpaqueBox, PublicBox } from "allowed-lib";',
        `export type PublicExactDepth = ${nestedReadonlyObjectType("VendorShape", 8)};`,
        `export interface PublicAllowedGenericExact { readonly box: PublicBox<${nestedReadonlyObjectType(
          "VendorShape",
          6,
        )}>; }`,
        `export interface PublicAllowedOpaqueGenericExact { readonly box: OpaqueBox<${nestedReadonlyObjectType(
          "VendorShape",
          6,
        )}>; }`,
        `export type PublicTooDeepProperty = ${nestedReadonlyObjectType("VendorShape", 9)};`,
        `export type PublicTooDeepUnion = ${nestedReadonlyObjectType(
          "{ readonly own: string } | VendorShape",
          8,
        )};`,
        `export interface PublicTooDeepReturn { readonly run: () => ${nestedReadonlyObjectType(
          "VendorShape",
          7,
        )}; }`,
        `export interface PublicTooDeepParam { readonly run: (input: ${nestedReadonlyObjectType(
          "VendorShape",
          7,
        )}) => void; }`,
        `export interface PublicTooDeepGeneric { readonly items: LocalBox<${nestedReadonlyObjectType(
          "VendorShape",
          7,
        )}>; }`,
        `export interface PublicAllowedGenericTooDeep { readonly box: PublicBox<${nestedReadonlyObjectType(
          "VendorShape",
          7,
        )}>; }`,
        `export interface PublicAllowedOpaqueGenericTooDeep { readonly box: OpaqueBox<${nestedReadonlyObjectType(
          "VendorShape",
          7,
        )}>; }`,
      ].join("\n"),
    );

    try {
      writeNodePackage(
        root,
        "allowed-lib",
        [
          "export interface PublicBox<T> { readonly boxed: T; }",
          "export interface OpaqueBox<T> {}",
        ].join("\n"),
      );
      const messages = diagnosticsForRule(
        publicTypeDiagnostics(root, { publicTypePackages: [{ package: "allowed-lib", reason: "test fixture" }] }),
        "no-public-vendor-type-leak",
      ).map((diagnostic) => diagnostic.message);
      const leakedExportNames = messages.flatMap((message) => {
        const match = /export "([^"]+)" references/.exec(message);
        return match ? [match[1]] : [];
      });

      expect(leakedExportNames).toContain("PublicExactDepth");
      expect(leakedExportNames).toContain("PublicAllowedGenericExact");
      expect(leakedExportNames).toContain("PublicAllowedOpaqueGenericExact");
      expect(leakedExportNames.filter((exportName) => exportName.startsWith("PublicTooDeep")))
        .toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
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
          publicTypeDiagnostics(dependencyRoot, { publicTypePackages: [{ package: "vendor-lib", reason: "test fixture" }] }),
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
    const diagnostic: ArchitectureDiagnostic = {
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
          const diagnostics: ArchitectureDiagnostic[] = messages.flatMap((message) => [
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

  it("normalizes options and clears the architecture cache without retaining stale reports", () => {
    const root = path.resolve("/repo");
    expect(resolveArchitectureOptions({ projectRoot: root, tsconfigPath: "tsconfig.eslint.json" }))
      .toMatchObject({
        projectRoot: root,
        tsconfigPath: path.resolve(root, "tsconfig.eslint.json"),
        minExportedSiblingModules: 4,
        maxExportedSiblingRatio: 0.6,
      });

    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acg-architecture-cache-"));
    try {
      fs.writeFileSync(
        path.join(projectRoot, "package.json"),
        JSON.stringify({
          name: "fixture",
          version: "1.0.0",
          type: "module",
          exports: { ".": "./dist/index.js" },
        }),
      );
      fs.writeFileSync(
        path.join(projectRoot, "tsconfig.json"),
        JSON.stringify({
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
        }),
      );
      fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
      fs.writeFileSync(
        path.join(projectRoot, "src", "index.ts"),
        [
          'export { M0 } from "./m0.js";',
          'export { M1 } from "./m1.js";',
          'export { M2 } from "./m2.js";',
          'export { M3 } from "./m3.js";',
        ].join("\n"),
      );
      for (let index = 0; index < 4; index += 1) {
        fs.writeFileSync(
          path.join(projectRoot, "src", `m${index}.ts`),
          `export const M${index} = ${index};\n`,
        );
      }

      const options = resolveArchitectureOptions({
        projectRoot,
        minExportedSiblingModules: 1,
        maxExportedSiblingRatio: 0,
      });
      const staleReport = cachedProjectArchitecture(options);
      expect(diagnosticsForRule(staleReport.diagnostics, "no-inventory-barrel")).toHaveLength(1);

      fs.writeFileSync(path.join(projectRoot, "src", "index.ts"), "export const ok = true;\n");
      expect(cachedProjectArchitecture(options)).toBe(staleReport);

      clearArchitectureCache();
      expect(
        diagnosticsForRule(cachedProjectArchitecture(options).diagnostics, "no-inventory-barrel"),
      ).toEqual([]);
    } finally {
      clearArchitectureCache();
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("Property: schema rejects bare-string allowance entries on every reason-bearing option", () => {
    const reasonBearingOptions = [
      "publicTypePackages",
      "infrastructureTypePackages",
      "allowedPublicSubpaths",
      "allowedTestPublicSubpaths",
      "sharedFolderNames",
    ] as const;
    fc.assert(
      fc.property(
        fc.constantFrom(...reasonBearingOptions),
        fc.array(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 4 }),
        (optionName, bareStrings) => {
          expect(() =>
            resolveArchitectureOptions({ [optionName]: bareStrings }),
          ).toThrowError(new RegExp(optionName));
        },
      ),
      { numRuns: 40 },
    );
  });

  it("Property: schema rejects allowance entries missing a reason on every reason-bearing option", () => {
    const valueKey = {
      publicTypePackages: "package",
      infrastructureTypePackages: "package",
      allowedPublicSubpaths: "subpath",
      allowedTestPublicSubpaths: "subpath",
      sharedFolderNames: "folder",
    } as const;
    fc.assert(
      fc.property(
        fc.constantFrom(...(Object.keys(valueKey) as Array<keyof typeof valueKey>)),
        fc.string({ minLength: 1, maxLength: 12 }),
        (optionName, value) => {
          const entry = { [valueKey[optionName]]: value };
          expect(() =>
            resolveArchitectureOptions({ [optionName]: [entry] }),
          ).toThrowError(/reason/i);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("Property: schema rejects packageRuntime values outside the allowed enum", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 16 })
          .filter((s) => !["browser", "node", "universal"].includes(s)),
        (badRuntime) => {
          expect(() =>
            resolveArchitectureOptions({ packageRuntime: badRuntime }),
          ).toThrowError(/packageRuntime/);
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe("file-header directive parser", () => {
  const loadParser = async () => import("../src/rules/architecture/directives.js");
  const RULE_IDS = [
    "no-inventory-barrel",
    "no-internal-subpath-export",
    "no-public-vendor-type-leak",
    "no-export-star-boundary",
    "no-folder-cycle",
    "no-root-internal-cycle",
    "no-large-public-surface",
    "no-cross-domain-sibling-import",
    "no-upward-layer-import",
    "no-public-test-helper-leak",
    "no-implementation-file-public-entry",
    "no-public-infra-type-leak",
    "no-package-mesh",
    "require-curated-public-facade",
    "require-boundary-owned-types",
  ] as const;

  // Preamble that may appear before a directive: license headers, imports,
  // blank lines, prior comments — anything except a comment line that itself
  // starts with the directive marker.
  const preambleArb = fc.array(
    fc.oneof(
      fc.constant("// SPDX-License-Identifier: MIT"),
      fc.constant("// Copyright (c) 2026"),
      fc.constant('import { foo } from "bar";'),
      fc.constant('"use strict";'),
      fc.constant(""),
      fc.constant("/* block license comment */"),
      fc
        .string({ minLength: 1, maxLength: 30 })
        .filter((s) => !s.includes("@agent-code-guard"))
        .map((s) => `// ${s}`),
    ),
    { minLength: 0, maxLength: 8 },
  );

  function makeSourceFile(name: string, source: string): ts.SourceFile {
    return ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  }

  it("Property: directives parse regardless of leading file content", async () => {
    const { parseDirectivesFromSourceFile } = await loadParser();
    fc.assert(
      fc.property(
        preambleArb,
        fc.constantFrom(...RULE_IDS),
        fc.string({ minLength: 1, maxLength: 60 }).filter((s) => s.trim().length > 0),
        (preamble, ruleId, reason) => {
          const source =
            preamble.join("\n") +
            (preamble.length > 0 ? "\n\n" : "") +
            `// @agent-code-guard/architecture-exception: ${ruleId}\n` +
            `// reason: ${reason.replace(/\r?\n/g, " ")}\n\n` +
            "export const value = 1;\n";
          const result = parseDirectivesFromSourceFile(makeSourceFile("test.ts", source));
          expect(result.errors).toEqual([]);
          expect(result.directives).toHaveLength(1);
          expect(result.directives[0]?.ruleId).toBe(ruleId);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("Property: a marker-prefixed line that doesn't match the strict pattern is always flagged", async () => {
    const { parseDirectivesFromSourceFile } = await loadParser();
    fc.assert(
      fc.property(
        // Either: trailing junk after a real rule-id, OR garbage instead of a rule-id.
        fc.oneof(
          fc.tuple(
            fc.constantFrom(...RULE_IDS),
            fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /\S/.test(s)),
          ).map(([rule, junk]) => `${rule} ${junk}`),
          fc
            .string({ minLength: 1, maxLength: 40 })
            .filter((s) => /\S/.test(s) && !/^[\w-]+$/.test(s.trim())),
        ),
        (badPayload) => {
          const source =
            `// @agent-code-guard/architecture-exception: ${badPayload}\n` +
            `// reason: should not reach here\n\n` +
            "export const value = 1;\n";
          const result = parseDirectivesFromSourceFile(makeSourceFile("malformed.ts", source));
          expect(result.directives).toEqual([]);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some((e) => /Malformed|Unknown/.test(e.message))).toBe(true);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("Property: unknown rule-ids are always rejected", async () => {
    const { parseDirectivesFromSourceFile } = await loadParser();
    const knownIds = new Set<string>(RULE_IDS);
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: 30 })
          .filter((s) => /^[a-z][a-z0-9-]*$/.test(s) && !knownIds.has(s)),
        (unknownRule) => {
          const source =
            `// @agent-code-guard/architecture-exception: ${unknownRule}\n` +
            `// reason: typo\n\n` +
            "export const value = 1;\n";
          const result = parseDirectivesFromSourceFile(makeSourceFile("typo.ts", source));
          expect(result.directives).toEqual([]);
          expect(
            result.errors.some((e) => e.message.includes("Unknown architecture rule id")),
          ).toBe(true);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("Property: any non-matching comment between rule and reason terminates the pending directive", async () => {
    const { parseDirectivesFromSourceFile } = await loadParser();
    const interveningLineArb = fc
      .string({ minLength: 1, maxLength: 40 })
      .filter((s) => /\S/.test(s) && !/^reason\b/i.test(s.trim()) && !s.includes("@agent-code-guard"))
      .map((s) => `// ${s}`);
    fc.assert(
      fc.property(
        fc.constantFrom(...RULE_IDS),
        fc.array(interveningLineArb, { minLength: 1, maxLength: 4 }),
        (ruleId, intervening) => {
          const source =
            `// @agent-code-guard/architecture-exception: ${ruleId}\n` +
            intervening.join("\n") +
            `\n// reason: too-late\n\n` +
            "export const value = 1;\n";
          const result = parseDirectivesFromSourceFile(makeSourceFile("carry.ts", source));
          expect(result.directives).toEqual([]);
          expect(
            result.errors.some((e) => e.message.includes("missing a 'reason:' follow-up")),
          ).toBe(true);
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe("layer membership and cross-layer imports", () => {
  const loadProjectGraph = async () => import("../src/rules/architecture/project-graph.js");

  it("Property: longest matching prefix wins when a folder matches multiple layer entries", async () => {
    const { layerIndexFor } = await loadProjectGraph();
    fc.assert(
      fc.property(
        fc
          .tuple(
            fc.stringMatching(/^[a-z]{3,8}$/),
            fc.stringMatching(/^[a-z]{3,8}$/),
            fc.stringMatching(/^[a-z]{3,8}$/),
          )
          .filter(([a, b, c]) => a !== b && b !== c && a !== c),
        ([root, mid, leaf]) => {
          const folder = `${root}/${mid}/${leaf}`;
          const layers = [
            { name: "broad", folders: [root], reason: "test: broad" },
            { name: "narrow", folders: [`${root}/${mid}`], reason: "test: narrow" },
            { name: "other", folders: ["unrelated"], reason: "test: other" },
          ];
          expect(layerIndexFor(folder, layers)).toBe(1);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("Property: when entries match with equal length, the lower layer index wins", async () => {
    const { layerIndexFor } = await loadProjectGraph();
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,8}$/), (folder) => {
        const layers = [
          { name: "first", folders: [folder], reason: "test: first" },
          { name: "second", folders: [folder], reason: "test: second" },
        ];
        expect(layerIndexFor(folder, layers)).toBe(0);
      }),
      { numRuns: 40 },
    );
  });

  it("Property: a folder with no matching layer entry returns null", async () => {
    const { layerIndexFor } = await loadProjectGraph();
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{3,8}$/),
        fc.stringMatching(/^[a-z]{3,8}$/),
        (folder, otherFolder) => {
          if (folder === otherFolder) return;
          const layers = [
            { name: "only", folders: [otherFolder], reason: "test: only" },
          ];
          expect(layerIndexFor(folder, layers)).toBeNull();
        },
      ),
      { numRuns: 40 },
    );
  });

  it("Property: with no layers configured, layerIndexFor returns null for every folder", async () => {
    const { layerIndexFor } = await loadProjectGraph();
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9/-]{0,30}$/), (folder) => {
        expect(layerIndexFor(folder, [])).toBeNull();
      }),
      { numRuns: 40 },
    );
  });
});

describe("empty-default behavior for list options", () => {
  const REASON_BEARING_OPTIONS = [
    "publicTypePackages",
    "infrastructureTypePackages",
    "allowedPublicSubpaths",
    "allowedTestPublicSubpaths",
    "sharedFolderNames",
  ] as const;
  const STRICTNESS_OPTIONS = ["forbiddenSubpathSegments", "implementationPathSegments"] as const;

  it("Property: every reason-bearing list option resolves to an empty array when omitted", () => {
    fc.assert(
      fc.property(fc.constantFrom(...REASON_BEARING_OPTIONS), (optionName) => {
        const resolved = resolveArchitectureOptions({});
        expect(resolved[optionName]).toEqual([]);
      }),
      { numRuns: 40 },
    );
  });

  it("Property: every strictness list resolves to an empty array when omitted", () => {
    fc.assert(
      fc.property(fc.constantFrom(...STRICTNESS_OPTIONS), (optionName) => {
        const resolved = resolveArchitectureOptions({});
        expect(resolved[optionName]).toEqual([]);
      }),
      { numRuns: 20 },
    );
  });

  it("Property: layers resolves to an empty array when omitted", () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        const resolved = resolveArchitectureOptions({});
        expect(resolved.layers).toEqual([]);
      }),
      { numRuns: 5 },
    );
  });
});
