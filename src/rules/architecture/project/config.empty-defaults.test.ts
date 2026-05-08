import { expect, it } from "vitest";
import * as h from "../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

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
