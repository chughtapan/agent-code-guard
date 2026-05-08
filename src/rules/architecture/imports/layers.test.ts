import { expect, it } from "vitest";
import * as h from "../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

const loadProjectGraph = async () => import("./project-graph/index.js");

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

it("Property: layer folder prefixes match only on path segment boundaries", () => {
  fc.assert(
    fc.property(
      fc
        .tuple(fc.stringMatching(/^[a-z]{3,8}$/), fc.stringMatching(/^[a-z]{1,4}$/))
        .filter(([prefix, suffix]) => !`${prefix}${suffix}`.startsWith(`${prefix}/`)),
      ([prefix, suffix]) => {
        const layers = [
          { name: "prefix", folders: [prefix], reason: "test: prefix layer" },
        ];

        expect(layerIndexFor(`${prefix}/${suffix}`, layers)).toBe(0);
        expect(layerIndexFor(`${prefix}${suffix}`, layers)).toBeNull();
      },
    ),
    { numRuns: 40 },
  );
});

it("root layer entry matches the root folder only", () => {
  const layers = [
    { name: "root", folders: ["."], reason: "test: package root" },
  ];

  expect(layerIndexFor(".", layers)).toBe(0);
  expect(layerIndexFor("feature", layers)).toBeNull();
  expect(layerIndexFor("feature/deep", layers)).toBeNull();
});
