import { expect, it } from "vitest";
import * as h from "../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

it("Property: public signature diagnostics inspect properties, unions, generics, calls, and constructors", () => {
  expect.hasAssertions();
  fc.assert(
    fc.property(packageSegmentArb, assertPublicSignatureLeakCoverage),
    { numRuns: 3 },
  );
});

it("limits public signature traversal depth while preserving exact-boundary leaks", () => {
  const root = writePublicTypeProject("vendor-lib", depthBoundaryPublicSource());

  try {
    writeNodePackage(
      root,
      "allowed-lib",
      [
        "export interface PublicBox<T> { readonly boxed: T; }",
        "export interface OpaqueBox<T> {}",
      ].join("\n"),
    );
    const leakedExportNames = leakedDepthBoundaryExports(root);

    expect(leakedExportNames).toContain("PublicExactDepth");
    expect(leakedExportNames).toContain("PublicAllowedGenericExact");
    expect(leakedExportNames).toContain("PublicAllowedOpaqueGenericExact");
    expect(leakedExportNames.filter((exportName) => exportName.startsWith("PublicTooDeep")))
      .toEqual([]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function assertPublicSignatureLeakCoverage(packageName: string): void {
  const root = writePublicTypeProject(packageName, publicSignatureFixtureSource(packageName));
  try {
    const messages = diagnosticsForRule(
      publicTypeDiagnostics(root),
      "no-public-vendor-type-leak",
    ).map((diagnostic) => diagnostic.message);
    expectMissingVendorLeakMessages(messages, packageName);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function publicSignatureFixtureSource(packageName: string): string {
  return [
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
  ].join("\n");
}

function expectMissingVendorLeakMessages(
  messages: readonly string[],
  packageName: string,
): void {
  const missingExportNames = expectedPublicSignatureExportNames().filter(
    (exportName) => !hasExpectedVendorLeak(messages, packageName, exportName),
  );
  expect(missingExportNames).toEqual([]);
}

function hasExpectedVendorLeak(
  messages: readonly string[],
  packageName: string,
  exportName: string,
): boolean {
  for (const message of messages) {
    if (
      message.includes(`export "${exportName}" references`) &&
      message.includes(packageName) &&
      message.includes("types. Wrap vendor types behind domain-owned public types") &&
      message.includes("publicTypePackages")
    ) {
      return true;
    }
  }
  return false;
}

function expectedPublicSignatureExportNames(): readonly string[] {
  return [
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
}

function depthBoundaryPublicSource(): string {
  return [
    'import type { VendorShape } from "vendor-lib";',
    "type LocalBox<T> = { readonly boxed: T };",
    'import type { OpaqueBox, PublicBox } from "allowed-lib";',
    `export type PublicExactDepth = ${nestedReadonlyObjectType("VendorShape", 8)};`,
    `export interface PublicAllowedGenericExact { readonly box: PublicBox<${nestedReadonlyObjectType("VendorShape", 6)}>; }`,
    `export interface PublicAllowedOpaqueGenericExact { readonly box: OpaqueBox<${nestedReadonlyObjectType("VendorShape", 6)}>; }`,
    `export type PublicTooDeepProperty = ${nestedReadonlyObjectType("VendorShape", 9)};`,
    `export type PublicTooDeepUnion = ${nestedReadonlyObjectType("{ readonly own: string } | VendorShape", 8)};`,
    `export interface PublicTooDeepReturn { readonly run: () => ${nestedReadonlyObjectType("VendorShape", 7)}; }`,
    `export interface PublicTooDeepParam { readonly run: (input: ${nestedReadonlyObjectType("VendorShape", 7)}) => void; }`,
    `export interface PublicTooDeepGeneric { readonly items: LocalBox<${nestedReadonlyObjectType("VendorShape", 7)}>; }`,
    `export interface PublicAllowedGenericTooDeep { readonly box: PublicBox<${nestedReadonlyObjectType("VendorShape", 7)}>; }`,
    `export interface PublicAllowedOpaqueGenericTooDeep { readonly box: OpaqueBox<${nestedReadonlyObjectType("VendorShape", 7)}>; }`,
  ].join("\n");
}

function leakedDepthBoundaryExports(root: string): readonly string[] {
  const messages = diagnosticsForRule(
    publicTypeDiagnostics(root, {
      publicTypePackages: [{ package: "allowed-lib", reason: "test fixture" }],
    }),
    "no-public-vendor-type-leak",
  ).map((diagnostic) => diagnostic.message);

  return messages.flatMap((message) => {
    const match = /export "([^"]+)" references/.exec(message);
    return match ? [match[1]] : [];
  });
}

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
