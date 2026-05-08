import { expect, it } from "vitest";
import * as h from "../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

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

it("Property: local specifier resolution follows every source/output extension pair", () => {
  fc.assert(
    fc.property(segmentArb, sourceExtensionArb, fc.constantFrom(...OUTPUT_EXTENSIONS), (
      moduleName,
      sourceExtension,
      outputExtension,
    ) => {
      const root = path.resolve("/repo");
      const target = path.resolve(root, "src", `${moduleName}${sourceExtension}`);
      const sourceFiles = new Map([
        [
          target,
          ts.createSourceFile(target, "export const ok = true;", ts.ScriptTarget.Latest),
        ],
      ]);

      expect(
        resolveLocalSpecifier(
          path.resolve(root, "src/index.ts"),
          `./${moduleName}`,
          sourceFiles,
        ),
      ).toBe(target);
      expect(
        resolveLocalSpecifier(
          path.resolve(root, "src/index.ts"),
          `./${moduleName}${outputExtension}`,
          sourceFiles,
        ),
      ).toBe(target);
      expect(
        resolveLocalSpecifier(
          path.resolve(root, "src/index.ts"),
          moduleName,
          sourceFiles,
        ),
      ).toBeNull();
    }),
    { numRuns: 80 },
  );
});

it("computes folder keys, top folders, test-like paths, and folder graph density", () => {
  const root = path.resolve("/repo");
  expect(folderKeyForFile(path.resolve(root, "src/index.ts"), root)).toBe(".");
  expect(folderKeyForFile(path.resolve(root, "src/domain/model.ts"), root)).toBe(
    "domain",
  );
  expect(folderKeyForFile(path.resolve(root, "scripts/release.ts"), root)).toBe(
    "scripts",
  );
  expect(topFolder(".")).toBe(".");
  expect(topFolder("domain/payments")).toBe("domain");
  expect(isTestLikePath(path.resolve(root, "src/test-utils/index.ts"))).toBe(true);

  const edges = [
    { from: "a", to: "b", kind: "import" as const, files: ["/repo/src/a.ts"] },
    { from: "b", to: "a", kind: "import" as const, files: ["/repo/src/b.ts"] },
  ];
  expect(stronglyConnectedFolderComponents(edges)).toEqual([["a", "b"]]);
  expect(folderEdgeDensity(["a", "b"], edges)).toBe(1);
  expect(folderEdgeDensity([], edges)).toBe(0);
  expect(folderEdgeDensity(["a"], edges)).toBe(0);
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

it("Property: folder rings form one sorted strongly connected component", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(segmentArb, { minLength: 2, maxLength: 7 }),
      (segments) => {
        const edges = segments.map((segment, index) => ({
          from: segment,
          to: segments[(index + 1) % segments.length] ?? segment,
          kind: "import" as const,
          files: [`/repo/src/${segment}/index.ts`],
        }));

        expect(stronglyConnectedFolderComponents(edges)).toEqual([
          [...segments].sort(),
        ]);
      },
    ),
    { numRuns: 80 },
  );
});

it("Property: folder edge density counts unique folder directions only", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(segmentArb, { minLength: 2, maxLength: 7 }),
      (folders) => {
        const baseEdges = folders.slice(0, -1).map((folder, index) => ({
          from: folder,
          to: folders[index + 1] ?? folder,
          kind: "import" as const,
          files: [`/repo/src/${folder}/index.ts`],
        }));
        const duplicateEdges = baseEdges.flatMap((edge) => [
          edge,
          { ...edge, files: ["/repo/src/duplicate.ts"] },
          { ...edge, kind: "reexport" as const, files: ["/repo/src/reexport.ts"] },
        ]);
        const expectedDensity = baseEdges.length / (folders.length * (folders.length - 1));

        expect(folderEdgeDensity(folders, duplicateEdges)).toBeCloseTo(expectedDensity);
      },
    ),
    { numRuns: 80 },
  );
});

it("Property: canonical test-only paths are detected by segment or file suffix", () => {
  fc.assert(
    fc.property(
      segmentArb,
      testOnlySegmentArb,
      fc.constantFrom(".test.ts", ".spec.tsx", ".test.mts", ".spec.cts"),
      (moduleName, testOnlySegment, testSuffix) => {
        const root = path.resolve("/repo");

        expect(
          isTestLikePath(path.resolve(root, "src", testOnlySegment, `${moduleName}.ts`)),
        ).toBe(true);
        expect(isTestLikePath(path.resolve(root, "src", testOnlySegment)))
          .toBe(true);
        expect(isTestLikePath(path.resolve(root, "src", "fixture", `${moduleName}.ts`)))
          .toBe(true);
        expect(
          isTestLikePath(path.resolve(root, "src", `${testOnlySegment}-prod`, `${moduleName}.ts`)),
        ).toBe(false);
        expect(isTestLikePath(path.resolve(root, "src", `${moduleName}${testSuffix}`)))
          .toBe(true);
        expect(isTestLikePath(path.resolve(root, "src", `${moduleName}.prod.ts`)))
          .toBe(false);
      },
    ),
    { numRuns: 80 },
  );
});
