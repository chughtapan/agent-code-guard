import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as fc from "fast-check";
import ts from "typescript";
import { checkPackageExports } from "../package-api/index.js";
import { checkPublicVendorTypeLeaks } from "../type-surface/index.js";
import { resolveArchitectureOptions } from "../project/config.js";
import { createProgram } from "../project/source-files.js";
import { readPackageJson } from "../package-api/index.js";
import {
  SOURCE_EXTENSIONS,
} from "../project/source-paths.js";
import type {
  ArchitectureDiagnostic,
  PackageJson,
} from "../project/diagnostics/index.js";

export { fs, os, path, fc, ts };
export {
  exportDeclarationIsTypeOnly,
  exportedSiblingModuleKeys,
  eligibleSiblingModuleKeys,
  inventoryBarrelDiagnostic,
  isExcludedSourceFile,
  isIndexSourceFile,
  siblingModuleKeyFromSpecifier,
  sourceModuleKey,
} from "../exports/inventory-barrels.js";
export {
  checkPackageExports,
  packagePathSegments,
  packageReportPath,
  pathHasForbiddenSegment,
} from "../package-api/index.js";
export {
  checkPublicVendorTypeLeaks,
  externalReExportDiagnostics,
  normalizeTypePackageName,
  packageAllowedInPublicTypes,
  packageNameFromFileName,
  packageNameFromSpecifier,
} from "../type-surface/index.js";
export {
  cachedProjectArchitecture,
  clearArchitectureCache,
  clearWorkspaceCache,
  getOrCreateWorkspaceCache,
} from "../project/cache/index.js";
export { uniqueDiagnostics } from "../project/diagnostics/index.js";
export { resolveArchitectureOptions } from "../project/config.js";
export { collectExportsValue, collectPackageExportEntries } from "../package-api/index.js";
export { readPackageJson } from "../package-api/index.js";
export {
  candidateSourcePaths,
  createProgram,
  findPackageReportFile,
  projectSourceFiles,
  publicApiSourceFiles,
  sourcePathForPackageTarget,
} from "../project/source-files.js";
export {
  folderEdgeDensity,
  stronglyConnectedFolderComponents,
} from "../imports/folder-graph/index.js";
export {
  buildProjectGraph,
  folderKeyForFile,
  layerIndexFor,
  resolveLocalSpecifier,
  topFolder,
} from "../imports/project-graph/index.js";
export {
  exportedDeclarationName,
  hasExportModifier,
  isStarExportDeclaration,
  isTestLikePath,
} from "../project/index.js";
export {
  hasSourceExtension,
  OUTPUT_EXTENSIONS,
  replaceKnownExtension,
  SOURCE_EXTENSIONS,
  stripKnownExtension,
  withTrailingSeparator,
} from "../project/source-paths.js";
export type { ArchitectureDiagnostic, PackageJson } from "../project/diagnostics/index.js";

export const segmentArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/);
export const packageSegmentArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/);
export const scopedPackageArb = fc.tuple(packageSegmentArb, packageSegmentArb);
export const sourceExtensionArb = fc.constantFrom(...SOURCE_EXTENSIONS);
export const testOnlySegmentArb = fc.constantFrom(
  "test",
  "tests",
  "testing",
  "test-utils",
  "test-support",
  "fixtures",
  "__fixtures__",
  "__tests__",
);

export type DependencyKind = "dependencies" | "devDependencies" | "peerDependencies";

export function exportSourceFileFor(modules: readonly string[], typeOnly: boolean): ts.SourceFile {
  const keyword = typeOnly ? "export type" : "export";
  return ts.createSourceFile(
    "index.ts",
    modules.map((moduleName, index) => `${keyword} { M${index} } from "./${moduleName}";`).join("\n"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

export function writeSiblingModules(
  directory: string,
  eligibleCount: number,
  exportedCount: number,
): ts.SourceFile {
  fs.mkdirSync(directory, { recursive: true });
  const exportLines = siblingExportLines(exportedCount);
  const indexPath = path.join(directory, "index.ts");
  fs.writeFileSync(indexPath, exportLines.join("\n"));
  writeSiblingModuleFiles(directory, eligibleCount);
  fs.writeFileSync(path.join(directory, "ignored.test.ts"), "export const ignored = true;\n");
  return ts.createSourceFile(
    indexPath,
    exportLines.join("\n"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

export function packageJsonForExports(exportsValue: unknown): PackageJson {
  return {
    name: "pkg",
    exports: exportsValue,
    dependencies: new Map(),
    devDependencies: new Map(),
    peerDependencies: new Map(),
  };
}

export function packageExportDiagnostics(
  exportsValue: unknown,
  options: Parameters<typeof resolveArchitectureOptions>[0] = {},
): readonly ArchitectureDiagnostic[] {
  return checkPackageExports(
    packageJsonForExports(exportsValue),
    resolveArchitectureOptions({ projectRoot: "/repo", ...options }),
    "/repo/package.json",
  );
}

export function diagnosticsForRule(
  diagnostics: readonly ArchitectureDiagnostic[],
  ruleId: ArchitectureDiagnostic["ruleId"],
): readonly ArchitectureDiagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.ruleId === ruleId);
}

export function programFromSourceFiles(sourceFiles: readonly ts.SourceFile[]): ts.Program {
  return { getSourceFiles: () => [...sourceFiles] } as ts.Program;
}

export function sourceFileAt(root: string, relativePath: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    path.resolve(root, relativePath),
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

export function sourceFilesByRelativePath(
  root: string,
  files: Record<string, string>,
): readonly ts.SourceFile[] {
  return Object.entries(files).map(([relativePath, text]) =>
    sourceFileAt(root, relativePath, text),
  );
}

export function writePublicTypeProject(
  packageName: string,
  publicSource: string,
  dependencyKind: DependencyKind = "dependencies",
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-public-type-"));
  for (const [relativePath, contents] of Object.entries(
    publicTypeProjectFiles(packageName, publicSource, dependencyKind),
  )) {
    writeFixtureFile(root, relativePath, contents);
  }
  return root;
}

export function writeNodePackage(root: string, packageName: string, declarations: string): void {
  writeFixtureFile(
    root,
    `node_modules/${packageName}/package.json`,
    JSON.stringify({ name: packageName, version: "1.0.0", types: "index.d.ts" }),
  );
  writeFixtureFile(root, `node_modules/${packageName}/index.d.ts`, declarations);
}

export function publicTypeDiagnostics(
  root: string,
  options: Parameters<typeof resolveArchitectureOptions>[0] = {},
): readonly ArchitectureDiagnostic[] {
  const normalizedOptions = resolveArchitectureOptions({ projectRoot: root, ...options });
  const program = createProgram(normalizedOptions);
  const packageJson = readPackageJson(root);
  if (program === null || packageJson === null) return [];
  return checkPublicVendorTypeLeaks(program, packageJson, normalizedOptions);
}

export function nestedReadonlyObjectType(leafType: string, depth: number): string {
  return Array.from({ length: depth }).reduceRight(
    (inner, _unused, index) => `{ readonly step${index}: ${inner}; }`,
    leafType,
  );
}

function siblingExportLines(exportedCount: number): readonly string[] {
  return Array.from(
    { length: exportedCount },
    (_, index) => `export { M${index} } from "./m${index}";`,
  );
}

function writeSiblingModuleFiles(directory: string, eligibleCount: number): void {
  for (let index = 0; index < eligibleCount; index += 1) {
    fs.writeFileSync(path.join(directory, `m${index}.ts`), `export const M${index} = ${index};\n`);
  }
}

function publicTypeProjectFiles(
  packageName: string,
  publicSource: string,
  dependencyKind: DependencyKind,
): Record<string, string> {
  return {
    "package.json": JSON.stringify(publicTypePackageJson(packageName, dependencyKind), null, 2),
    "tsconfig.json": JSON.stringify(publicTypeTsconfig(), null, 2),
    "src/index.ts": publicSource,
    [`node_modules/${packageName}/package.json`]: JSON.stringify({
      name: packageName,
      version: "1.0.0",
      types: "index.d.ts",
    }),
    [`node_modules/${packageName}/index.d.ts`]:
      "export interface VendorShape<T = unknown> { readonly value: T; }\n",
  };
}

function publicTypePackageJson(
  packageName: string,
  dependencyKind: DependencyKind,
): Record<string, unknown> {
  return {
    name: "fixture",
    version: "1.0.0",
    type: "module",
    [dependencyKind]: { [packageName]: "1.0.0" },
    exports: { ".": { import: "./dist/index.js", types: "./dist/index.d.ts" } },
  };
}

function publicTypeTsconfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      declaration: true,
      outDir: "./dist",
      rootDir: "./src",
    },
    include: ["src/**/*"],
  };
}

function writeFixtureFile(root: string, relativePath: string, contents: string): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents);
}
