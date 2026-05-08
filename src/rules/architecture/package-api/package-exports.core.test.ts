import { expect, it } from "vitest";
import * as h from "../test-support/helper-fixtures.js";
import type { PackageJson } from "../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;
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

      const forbiddenGlob = `${forbidden}*.js`;
      const presentPath = `./${[...cleanSegments, forbiddenGlob].join("\\")}`;
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
