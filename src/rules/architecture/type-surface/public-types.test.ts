import { expect, it } from "vitest";
import * as h from "../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

it("normalizes external type package names", () => {
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
});

it("applies public type allowlist policy", () => {
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
  expect.hasAssertions();
  fc.assert(
    fc.property(packageSegmentArb, fc.boolean(), assertExternalReExportPolicy),
    { numRuns: 40 },
  );
});

it("ignores local public re-exports for vendor type leak checks", () => {
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

function assertExternalReExportPolicy(packageName: string, allowed: boolean): void {
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
    return;
  }

  expect(diagnostics).toHaveLength(1);
  const diagnostic = diagnostics[0];
  if (diagnostic === undefined) {
    throw new Error("expected vendor re-export diagnostic");
  }
  expect(diagnostic).toEqual(expect.objectContaining({
    ruleId: "no-public-vendor-type-leak",
    file: sourceFile.fileName,
    severity: "error",
    message: expect.stringContaining(packageName),
  }));
  expect(diagnostic.message).toContain(specifier);
  expect(diagnostic.message).toContain("domain-owned public types");
  expect(diagnostic.message).toContain("publicTypePackages");
}

it("reports infrastructure and Node public re-export policy separately", () => {
  expectInfrastructureReExportDiagnostics();
  expectNodePublicReExportPolicy();
});

function expectInfrastructureReExportDiagnostics(): void {
  const diagnostics = infrastructureReExportDiagnostics();
  expect(diagnostics).toEqual([
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

  const infraDiagnostic = diagnostics[1];
  if (infraDiagnostic === undefined) {
    throw new Error("expected infrastructure diagnostic");
  }
  expect(infraDiagnostic.message).toContain(
    "Database, logging, transport, and SDK implementation choices",
  );
  expect(infraDiagnostic.message).toContain("package-owned ports or DTOs");
}

function expectNodePublicReExportPolicy(): void {
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
}

function infrastructureReExportDiagnostics(): ReturnType<typeof externalReExportDiagnostics> {
  const infraSourceFile = ts.createSourceFile(
    "/repo/src/index.ts",
    'export type { Kysely } from "kysely";',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  return externalReExportDiagnostics(
    infraSourceFile,
    resolveArchitectureOptions({
      projectRoot: "/repo",
      infrastructureTypePackages: [{ package: "kysely", reason: "test fixture" }],
    }),
  );
}
