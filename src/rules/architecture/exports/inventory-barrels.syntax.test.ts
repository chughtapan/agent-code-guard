import { expect, it } from "vitest";
import * as h from "../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

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
  const fixturePath = path.join(path.sep, "repo", "demo");
  expect(withTrailingSeparator(fixturePath)).toBe(`${fixturePath}${path.sep}`);
  expect(withTrailingSeparator(`${fixturePath}${path.sep}`)).toBe(`${fixturePath}${path.sep}`);
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
