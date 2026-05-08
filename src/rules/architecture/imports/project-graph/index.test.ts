import { expect, it } from "vitest";
import type { ProjectArchitectureGraph } from "./index.js";
import * as h from "../../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

const EXPORT_CLASSIFICATION_SOURCE = [
  "export function makeThing() {}",
  "export class Thing {}",
  "export interface Shape { readonly id: string; }",
  "export type Alias = string;",
  "export enum Mode { One }",
  "export const first = 1, second = 2;",
  "const local = 1;",
  'export * from "./star";',
  'export { value } from "./value";',
  'export * as named from "./named";',
  "export default class {}",
  "export default first;",
].join("\n");

const EXPORTED_DECLARATION_NAMES = [
  "makeThing",
  "Thing",
  "Shape",
  "Alias",
  "Mode",
  "first",
  "local",
  null,
  null,
  null,
  null,
  null,
];

const EXPORT_MODIFIER_FLAGS = [
  true,
  true,
  true,
  true,
  true,
  true,
  false,
  false,
  false,
  false,
  true,
  false,
];

const STAR_EXPORT_FLAGS = [
  false,
  false,
  false,
  false,
  false,
  false,
  false,
  true,
  false,
  false,
  false,
  false,
];

const GRAPH_EXTERNAL_EDGES = [
  { packageName: "vendor-lib", kind: "import", typeOnly: true, specifier: "vendor-lib" },
  { packageName: "runtime-lib", kind: "import", typeOnly: false, specifier: "runtime-lib" },
  { packageName: "types-lib", kind: "import", typeOnly: true, specifier: "types-lib" },
  { packageName: "node", kind: "import", typeOnly: true, specifier: "node:stream" },
  { packageName: "@scope/pkg", kind: "import", typeOnly: true, specifier: "@scope/pkg/subpath" },
] as const;

it("classifies exported declarations and export-star declarations from syntax shape", () => {
  const sourceFile = ts.createSourceFile(
    "index.ts",
    EXPORT_CLASSIFICATION_SOURCE,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  expect(sourceFile.statements.map(exportedDeclarationName)).toEqual(EXPORTED_DECLARATION_NAMES);
  expect(sourceFile.statements.map(hasExportModifier)).toEqual(EXPORT_MODIFIER_FLAGS);
  expect(sourceFile.statements.map(isStarExportDeclaration)).toEqual(STAR_EXPORT_FLAGS);
});

it("builds project graph metadata for public files, typed edges, and folder edges", () => {
  const root = path.resolve("/repo");
  const graph = buildGraphMetadataFixture(root);

  expectGraphPublicMetadata(graph);
  expectGraphLocalEdges(graph, root);
  expectGraphExternalEdges(graph);
  expectGraphExportConsumers(graph, root);
  expectGraphFolderEdges(graph, root);
});

function buildGraphMetadataFixture(root: string): ProjectArchitectureGraph {
  return buildProjectGraph(
    sourceFilesByRelativePath(root, graphMetadataSources()),
    packageJsonForExports({ ".": "./dist/index.js", "./direct": "./src/direct.ts" }),
    resolveArchitectureOptions({
      projectRoot: root,
      layers: [
        { name: "root", folders: ["."], reason: "test: public root" },
        { name: "feature", folders: ["feature"], reason: "test: feature layer" },
        { name: "internal", folders: ["internal"], reason: "test: internal layer" },
      ],
    }),
    path.resolve(root, "package.json"),
  );
}

function graphMetadataSources(): Record<string, string> {
  return {
    "src/index.ts": [
      'import type { ExternalType } from "vendor-lib";',
      'import { runtime } from "runtime-lib";',
      'import { type NamedType } from "types-lib";',
      'import type { Readable } from "node:stream";',
      'import type { Scoped } from "@scope/pkg/subpath";',
      'export type { LocalType } from "./types";',
      'export { value } from "./feature/value";',
      'export * from "./star";',
      'export * as named from "./named";',
      "export const own = runtime, second = 2;",
      "export interface PublicShape { readonly field: ExternalType | NamedType | Readable | Scoped; }",
      "export default own;",
    ].join("\n"),
    "src/types.ts": "export interface LocalType { readonly id: string; }\n",
    "src/feature/value.ts": "export const value = true;\n",
    "src/star.ts": "export const star = true;\n",
    "src/named.ts": "export const named = true;\n",
    "src/internal/worker.ts": 'import { value } from "../feature/value";\n',
    "src/direct.ts": "export const direct = true;\n",
  };
}

function expectGraphPublicMetadata(graph: ProjectArchitectureGraph): void {
  expect(graph.publicModules.map((module) => module.relativePath)).toEqual([
    "src/index.ts",
    "src/direct.ts",
  ]);
  expect(graph.folders).toEqual([".", "feature", "internal"]);
  expect([...graph.folderLayerIndex.entries()]).toEqual([
    [".", 0],
    ["feature", 1],
    ["internal", 2],
  ]);

  const publicModule = graph.publicModules[0];
  expect(publicModule?.exportedSymbolCount).toBe(8);
  expect(publicModule?.exportedSymbols).toEqual([
    "LocalType",
    "PublicShape",
    "default",
    "named",
    "own",
    "second",
    "value",
  ]);
  expect(publicModule?.localReexportCount).toBe(4);
  expect(publicModule?.starExportCount).toBe(1);
}

function expectGraphLocalEdges(graph: ProjectArchitectureGraph, root: string): void {
  expect(graph.localEdges.map((edge) => ({
    from: relativeFixturePath(root, edge.from),
    to: relativeFixturePath(root, edge.to),
    kind: edge.kind,
    typeOnly: edge.typeOnly,
    specifier: edge.specifier,
  }))).toEqual([
    { from: "src/index.ts", to: "src/types.ts", kind: "reexport", typeOnly: true, specifier: "./types" },
    {
      from: "src/index.ts",
      to: "src/feature/value.ts",
      kind: "reexport",
      typeOnly: false,
      specifier: "./feature/value",
    },
    { from: "src/index.ts", to: "src/star.ts", kind: "reexport", typeOnly: false, specifier: "./star" },
    { from: "src/index.ts", to: "src/named.ts", kind: "reexport", typeOnly: false, specifier: "./named" },
    {
      from: "src/internal/worker.ts",
      to: "src/feature/value.ts",
      kind: "import",
      typeOnly: false,
      specifier: "../feature/value",
    },
  ]);
}

function expectGraphExternalEdges(graph: ProjectArchitectureGraph): void {
  expect(graph.externalEdges.map((edge) => ({
    packageName: edge.packageName,
    kind: edge.kind,
    typeOnly: edge.typeOnly,
    specifier: edge.specifier,
  }))).toEqual(GRAPH_EXTERNAL_EDGES);
}

function expectGraphExportConsumers(graph: ProjectArchitectureGraph, root: string): void {
  expect(graph.exportConsumers.map((consumer) => ({
    target: relativeFixturePath(root, consumer.targetFile),
    exportName: consumer.exportName,
    consumer: relativeFixturePath(root, consumer.consumerFile),
    kind: consumer.kind,
    typeOnly: consumer.typeOnly,
  }))).toEqual([
    { target: "src/feature/value.ts", exportName: "value", consumer: "src/index.ts", kind: "reexport", typeOnly: false },
    {
      target: "src/feature/value.ts",
      exportName: "value",
      consumer: "src/internal/worker.ts",
      kind: "import",
      typeOnly: false,
    },
    { target: "src/types.ts", exportName: "LocalType", consumer: "src/index.ts", kind: "reexport", typeOnly: true },
  ]);
}

function expectGraphFolderEdges(graph: ProjectArchitectureGraph, root: string): void {
  expect(graph.folderEdges).toEqual([
    {
      from: ".",
      to: "feature",
      kind: "reexport",
      files: [path.resolve(root, "src/index.ts")],
    },
    {
      from: "internal",
      to: "feature",
      kind: "import",
      files: [path.resolve(root, "src/internal/worker.ts")],
    },
  ]);
}

function relativeFixturePath(root: string, fileName: string): string {
  return path.relative(root, fileName).replaceAll("\\", "/");
}

it("Property: graph public API fallback follows every conventional index candidate", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("src/index.ts", "src/index.tsx", "index.ts", "index.tsx"),
      (relativePath) => {
        const root = path.resolve("/repo");
        const sourceFiles = sourceFilesByRelativePath(root, {
          [relativePath]: "export const ok = true;\n",
          "src/private.ts": "export const privateValue = true;\n",
        });
        const graph = buildProjectGraph(
          sourceFiles,
          packageJsonForExports(undefined),
          resolveArchitectureOptions({ projectRoot: root }),
          path.resolve(root, "package.json"),
        );

        expect(graph.publicModules.map((module) => module.relativePath)).toEqual([
          relativePath,
        ]);
      },
    ),
    { numRuns: 20 },
  );
});

it("does not treat dist-remap candidates as public unless they exist", () => {
  const root = path.resolve("/repo");
  const sourceFiles = sourceFilesByRelativePath(root, {
    "src/index.ts": "export const root = true;\n",
    "src/direct.ts": "export const direct = true;\n",
    "src/src/direct.ts": "export const nestedDirect = true;\n",
  });
  const graph = buildProjectGraph(
    sourceFiles,
    packageJsonForExports({ "./direct": "./src/direct.ts" }),
    resolveArchitectureOptions({ projectRoot: root }),
    path.resolve(root, "package.json"),
  );

  expect(graph.publicModules.map((module) => module.relativePath)).toEqual(["src/direct.ts"]);
});

it("falls back to conventional public API files when package exports do not resolve", () => {
  const root = path.resolve("/repo");
  const sourceFiles = sourceFilesByRelativePath(root, {
    "src/index.ts": "export const ok = true;\n",
    "src/private.ts": "export const privateValue = true;\n",
  });
  const graph = buildProjectGraph(
    sourceFiles,
    packageJsonForExports({ "./missing": "./dist/missing.js" }),
    resolveArchitectureOptions({ projectRoot: root }),
    path.resolve(root, "package.json"),
  );

  expect(graph.publicModules.map((module) => module.relativePath)).toEqual(["src/index.ts"]);
});
