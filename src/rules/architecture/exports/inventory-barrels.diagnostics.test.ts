import { expect, it } from "vitest";
import type { SourceFile } from "typescript";
import * as h from "../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

type InventoryDiagnostic = ReturnType<typeof inventoryBarrelDiagnostic>[number];
type InventoryThresholdContext = {
  readonly eligibleCount: number;
  readonly exportedCount: number;
  readonly root: string;
  readonly sourceFile: SourceFile;
};

it("Property: inventory barrel diagnostics follow count and ratio thresholds", () => {
  expect.hasAssertions();
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 0, max: 12 }),
      fc.integer({ min: 1, max: 12 }),
      fc.constantFrom(0, 0.25, 0.5, 0.6, 0.75, 1),
      assertInventoryThresholdCase,
    ),
    { numRuns: 80 },
  );
});

it("Property: inventory diagnostics only run on index files with eligible siblings", () => {
  expect.hasAssertions();
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 8 }),
      fc.integer({ min: 1, max: 8 }),
      assertInventoryRequiresIndexWithEligibleSiblings,
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
  expect.hasAssertions();
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 8 }),
      fc.integer({ min: 1, max: 8 }),
      assertInventoryCountsOnlyExistingSiblings,
    ),
    { numRuns: 60 },
  );
});

function assertInventoryThresholdCase(
  eligibleCount: number,
  rawExportedCount: number,
  minExportedSiblingModules: number,
  maxExportedSiblingRatio: number,
): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-inventory-property-"));
  try {
    const exportedCount = Math.min(rawExportedCount, eligibleCount);
    const sourceFile = writeSiblingModules(
      path.join(root, "src", "widgets"),
      eligibleCount,
      exportedCount,
    );
    const diagnostics = inventoryBarrelDiagnostic(
      sourceFile,
      resolveArchitectureOptions({
        projectRoot: root,
        minExportedSiblingModules,
        maxExportedSiblingRatio,
      }),
    );

    expectInventoryThresholdDiagnostics(
      diagnostics,
      { eligibleCount, exportedCount, root, sourceFile },
      exportedCount >= minExportedSiblingModules &&
        exportedCount / eligibleCount >= maxExportedSiblingRatio,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function assertInventoryRequiresIndexWithEligibleSiblings(
  eligibleCount: number,
  exportedCount: number,
): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-inventory-boundary-"));
  try {
    const directory = path.join(root, "src", "widgets");
    expectInventoryIgnoresNonIndexFile(root, directory, eligibleCount, exportedCount);
    expectInventoryIgnoresIndexWithoutExistingSiblings(root, directory);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function assertInventoryCountsOnlyExistingSiblings(
  eligibleCount: number,
  extraExportCount: number,
): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-inventory-intersect-"));
  try {
    const sourceFile = writeMixedSiblingIndex(root, eligibleCount, extraExportCount);
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
}

function expectInventoryThresholdDiagnostics(
  diagnostics: readonly InventoryDiagnostic[],
  context: InventoryThresholdContext,
  shouldFlag: boolean,
): void {
  if (!shouldFlag) {
    expect(diagnostics).toEqual([]);
    return;
  }

  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]?.message).toContain(
    path.relative(context.root, context.sourceFile.fileName),
  );
  expect(diagnostics[0]?.message).toContain(
    `${context.exportedCount} of ${context.eligibleCount}`,
  );
  expect(diagnostics[0]?.message).toContain(
    "This exports inventory, not an abstraction",
  );
  expect(diagnostics[0]?.message).toContain(
    "ports, factories, and stable types only",
  );
}

function expectInventoryIgnoresNonIndexFile(
  root: string,
  directory: string,
  eligibleCount: number,
  exportedCount: number,
): void {
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

  expect(inventoryBarrelDiagnostic(nonIndexSourceFile, strictInventoryOptions(root)))
    .toEqual([]);
}

function expectInventoryIgnoresIndexWithoutExistingSiblings(
  root: string,
  directory: string,
): void {
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

  expect(inventoryBarrelDiagnostic(emptyIndexSourceFile, strictInventoryOptions(root)))
    .toEqual([]);
}

function writeMixedSiblingIndex(
  root: string,
  eligibleCount: number,
  extraExportCount: number,
): SourceFile {
  const directory = path.join(root, "src", "widgets");
  fs.mkdirSync(directory, { recursive: true });
  const indexPath = path.join(directory, "index.ts");
  const sourceText = [
    ...moduleExportLines("M", "m", eligibleCount),
    ...moduleExportLines("Ghost", "ghost", extraExportCount),
  ].join("\n");
  fs.writeFileSync(indexPath, sourceText);

  for (let index = 0; index < eligibleCount; index += 1) {
    fs.writeFileSync(path.join(directory, `m${index}.ts`), `export const M${index} = ${index};\n`);
  }

  return ts.createSourceFile(indexPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function moduleExportLines(
  exportedPrefix: string,
  modulePrefix: string,
  count: number,
): readonly string[] {
  return Array.from(
    { length: count },
    (_, index) => `export { ${exportedPrefix}${index} } from "./${modulePrefix}${index}";`,
  );
}

function strictInventoryOptions(root: string): ReturnType<typeof resolveArchitectureOptions> {
  return resolveArchitectureOptions({
    projectRoot: root,
    minExportedSiblingModules: 1,
    maxExportedSiblingRatio: 0,
  });
}

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
