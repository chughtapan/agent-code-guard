import { expect, it } from "vitest";
import * as h from "../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;
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
