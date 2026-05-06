import path from "node:path";
import ts from "typescript";
import { collectPackageExportEntries } from "./package-exports.js";
import {
  replaceKnownExtension,
  SOURCE_EXTENSIONS,
  stripKnownExtension,
  withTrailingSeparator,
} from "./path-utils.js";
import type { NormalizedTopologyOptions, PackageJson } from "./types.js";

export type ModuleEdgeKind = "import" | "reexport";

export interface LocalModuleEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: ModuleEdgeKind;
  readonly typeOnly: boolean;
  readonly specifier: string;
}

export interface ExternalModuleEdge {
  readonly from: string;
  readonly packageName: string;
  readonly kind: ModuleEdgeKind;
  readonly typeOnly: boolean;
  readonly specifier: string;
}

export interface SourceModule {
  readonly fileName: string;
  readonly relativePath: string;
  readonly folder: string;
  readonly topFolder: string;
  readonly isIndex: boolean;
  readonly isPublic: boolean;
  readonly isTestLike: boolean;
  readonly localEdges: readonly LocalModuleEdge[];
  readonly externalEdges: readonly ExternalModuleEdge[];
  readonly exportedSymbolCount: number;
  readonly localReexportCount: number;
  readonly starExportCount: number;
}

export interface FolderEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: ModuleEdgeKind;
  readonly files: readonly string[];
}

export interface ProjectTopologyGraph {
  readonly projectRoot: string;
  readonly reportFile: string;
  readonly modules: readonly SourceModule[];
  readonly modulesByFileName: ReadonlyMap<string, SourceModule>;
  readonly publicModules: readonly SourceModule[];
  readonly localEdges: readonly LocalModuleEdge[];
  readonly externalEdges: readonly ExternalModuleEdge[];
  readonly folderEdges: readonly FolderEdge[];
  readonly folders: readonly string[];
}

export function buildProjectGraph(
  sourceFiles: readonly ts.SourceFile[],
  packageJson: PackageJson | null,
  options: NormalizedTopologyOptions,
  reportFile: string,
): ProjectTopologyGraph {
  const sourceFilesByPath = new Map(
    sourceFiles.map((sourceFile) => [path.resolve(sourceFile.fileName), sourceFile] as const),
  );
  const publicFileNames = new Set(
    publicApiFileNames(sourceFilesByPath, packageJson, options),
  );

  const modules = sourceFiles.map((sourceFile) =>
    sourceModuleFromSourceFile(sourceFile, sourceFilesByPath, publicFileNames, options),
  );
  const modulesByFileName = new Map(
    modules.map((module) => [module.fileName, module] as const),
  );
  const localEdges = modules.flatMap((module) => [...module.localEdges]);
  const externalEdges = modules.flatMap((module) => [...module.externalEdges]);
  const publicModules = modules.filter((module) => module.isPublic);
  const folders = [...new Set(modules.map((module) => module.folder))].sort();

  return {
    projectRoot: options.projectRoot,
    reportFile,
    modules,
    modulesByFileName,
    publicModules,
    localEdges,
    externalEdges,
    folderEdges: collectFolderEdges(localEdges, modulesByFileName),
    folders,
  };
}

export function resolveLocalSpecifier(
  fromFile: string,
  specifier: string,
  sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>,
): string | null {
  if (!specifier.startsWith(".")) return null;

  const absolute = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    ...candidateFileNames(absolute),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(absolute, `index${extension}`)),
  ];

  return candidates.find((candidate) => sourceFilesByPath.has(candidate)) ?? null;
}

export function folderKeyForFile(fileName: string, projectRoot: string): string {
  const sourceRoot = path.join(projectRoot, "src");
  const sourceRootWithSlash = withTrailingSeparator(sourceRoot);
  const resolved = path.resolve(fileName);
  const base = resolved.startsWith(sourceRootWithSlash) ? sourceRoot : projectRoot;
  const relativeDirectory = path.relative(base, path.dirname(resolved));
  return relativeDirectory.length === 0 ? "." : normalizePath(relativeDirectory);
}

export function topFolder(folder: string): string {
  return folder === "." ? "." : folder.split("/")[0] ?? ".";
}

export function isTestLikePath(fileName: string): boolean {
  const normalized = normalizePath(fileName);
  return (
    /\.(test|spec)\.[cm]?[tj]sx?$/.test(normalized) ||
    /(^|\/)(__tests__|tests?|testing|test-utils|fixtures?|__fixtures__)(\/|$)/.test(
      normalized,
    )
  );
}

export function isStarExportDeclaration(statement: ts.Statement): boolean {
  return (
    ts.isExportDeclaration(statement) &&
    statement.exportClause === undefined &&
    statement.moduleSpecifier !== undefined
  );
}

export function exportedDeclarationName(statement: ts.Statement): string | null {
  if (ts.isFunctionDeclaration(statement)) return statement.name?.text ?? null;
  if (ts.isClassDeclaration(statement)) return statement.name?.text ?? null;
  if (ts.isInterfaceDeclaration(statement)) return statement.name.text;
  if (ts.isTypeAliasDeclaration(statement)) return statement.name.text;
  if (ts.isEnumDeclaration(statement)) return statement.name.text;
  if (!ts.isVariableStatement(statement)) return null;

  const declaration = statement.declarationList.declarations[0];
  const name = declaration?.name;
  return name && ts.isIdentifier(name) ? name.text : null;
}

export function hasExportModifier(statement: ts.Statement): boolean {
  return Boolean(
    ts.canHaveModifiers(statement) &&
      ts.getModifiers(statement)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
  );
}

export function normalizePath(pathLike: string): string {
  return pathLike.replaceAll("\\", "/");
}

function sourceModuleFromSourceFile(
  sourceFile: ts.SourceFile,
  sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>,
  publicFileNames: ReadonlySet<string>,
  options: NormalizedTopologyOptions,
): SourceModule {
  const fileName = path.resolve(sourceFile.fileName);
  const folder = folderKeyForFile(fileName, options.projectRoot);
  const edges = collectModuleEdges(sourceFile, sourceFilesByPath);

  return {
    fileName,
    relativePath: normalizePath(path.relative(options.projectRoot, fileName)),
    folder,
    topFolder: topFolder(folder),
    isIndex: path.parse(fileName).name === "index",
    isPublic: publicFileNames.has(fileName),
    isTestLike: isTestLikePath(fileName),
    localEdges: edges.localEdges,
    externalEdges: edges.externalEdges,
    exportedSymbolCount: countExportedSymbols(sourceFile),
    localReexportCount: edges.localEdges.filter((edge) => edge.kind === "reexport").length,
    starExportCount: sourceFile.statements.filter(isStarExportDeclaration).length,
  };
}

function collectModuleEdges(
  sourceFile: ts.SourceFile,
  sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>,
): {
  readonly localEdges: readonly LocalModuleEdge[];
  readonly externalEdges: readonly ExternalModuleEdge[];
} {
  const localEdges: LocalModuleEdge[] = [];
  const externalEdges: ExternalModuleEdge[] = [];

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      collectSpecifierEdge(
        sourceFile.fileName,
        statement.moduleSpecifier,
        importDeclarationIsTypeOnly(statement),
        "import",
        sourceFilesByPath,
        localEdges,
        externalEdges,
      );
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      collectSpecifierEdge(
        sourceFile.fileName,
        statement.moduleSpecifier,
        exportDeclarationIsTypeOnly(statement),
        "reexport",
        sourceFilesByPath,
        localEdges,
        externalEdges,
      );
    }
  }

  return { localEdges, externalEdges };
}

function collectSpecifierEdge(
  fromFile: string,
  moduleSpecifier: ts.Expression,
  typeOnly: boolean,
  kind: ModuleEdgeKind,
  sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>,
  localEdges: LocalModuleEdge[],
  externalEdges: ExternalModuleEdge[],
): void {
  if (!ts.isStringLiteral(moduleSpecifier)) return;

  const specifier = moduleSpecifier.text;
  const localTarget = resolveLocalSpecifier(fromFile, specifier, sourceFilesByPath);
  if (localTarget) {
    localEdges.push({
      from: path.resolve(fromFile),
      to: localTarget,
      kind,
      typeOnly,
      specifier,
    });
    return;
  }

  const packageName = packageNameFromSpecifier(specifier);
  if (packageName === null) return;

  externalEdges.push({
    from: path.resolve(fromFile),
    packageName,
    kind,
    typeOnly,
    specifier,
  });
}

function importDeclarationIsTypeOnly(statement: ts.ImportDeclaration): boolean {
  if (statement.importClause?.isTypeOnly) return true;
  const namedBindings = statement.importClause?.namedBindings;
  return Boolean(
    namedBindings &&
      ts.isNamedImports(namedBindings) &&
      namedBindings.elements.length > 0 &&
      namedBindings.elements.every((element) => element.isTypeOnly),
  );
}

function exportDeclarationIsTypeOnly(statement: ts.ExportDeclaration): boolean {
  if (statement.isTypeOnly) return true;
  if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) return false;
  return statement.exportClause.elements.every((specifier) => specifier.isTypeOnly);
}

function packageNameFromSpecifier(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("node:")) return "node";

  const segments = specifier.split("/");
  if (segments[0]?.startsWith("@")) return segments.slice(0, 2).join("/");
  return segments[0] ?? null;
}

function publicApiFileNames(
  sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>,
  packageJson: PackageJson | null,
  options: NormalizedTopologyOptions,
): ReadonlySet<string> {
  const publicFiles = new Set<string>();

  if (packageJson) {
    for (const entry of collectPackageExportEntries(packageJson)) {
      for (const candidate of sourceCandidatesForPackageTarget(entry.targetPath, options.projectRoot)) {
        if (sourceFilesByPath.has(candidate)) publicFiles.add(candidate);
      }
    }
  }

  if (publicFiles.size === 0) {
    for (const candidate of ["src/index.ts", "src/index.tsx", "index.ts", "index.tsx"]) {
      const resolved = path.resolve(options.projectRoot, candidate);
      if (sourceFilesByPath.has(resolved)) publicFiles.add(resolved);
    }
  }

  return publicFiles;
}

function sourceCandidatesForPackageTarget(
  targetPath: string,
  projectRoot: string,
): readonly string[] {
  const targetWithoutPrefix = normalizePath(targetPath).replace(/^\.\//, "");
  const relativePaths = targetWithoutPrefix.startsWith("dist/")
    ? [targetWithoutPrefix, `src/${targetWithoutPrefix.slice("dist/".length)}`]
    : [targetWithoutPrefix];

  return relativePaths.flatMap((relativePath) =>
    candidateFileNames(path.resolve(projectRoot, relativePath)),
  );
}

function candidateFileNames(absolutePath: string): readonly string[] {
  const extensionCandidates = SOURCE_EXTENSIONS.map((extension) =>
    path.resolve(replaceKnownExtension(absolutePath, extension)),
  );
  const stripped = stripKnownExtension(absolutePath);
  const strippedCandidates = SOURCE_EXTENSIONS.map((extension) =>
    path.resolve(`${stripped}${extension}`),
  );

  return [...new Set([...extensionCandidates, ...strippedCandidates])];
}

function countExportedSymbols(sourceFile: ts.SourceFile): number {
  return sourceFile.statements.reduce((count, statement) => {
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) return count + 1;
      if (ts.isNamedExports(statement.exportClause)) {
        return count + statement.exportClause.elements.length;
      }
      return count + 1;
    }

    if (ts.isExportAssignment(statement)) return count + 1;
    if (!hasExportModifier(statement)) return count;
    if (ts.isVariableStatement(statement)) {
      return count + statement.declarationList.declarations.length;
    }
    return count + 1;
  }, 0);
}

function collectFolderEdges(
  localEdges: readonly LocalModuleEdge[],
  modulesByFileName: ReadonlyMap<string, SourceModule>,
): readonly FolderEdge[] {
  const edgeFilesByKey = new Map<string, Set<string>>();
  const edgeMetadataByKey = new Map<string, Omit<FolderEdge, "files">>();

  for (const edge of localEdges) {
    const fromModule = modulesByFileName.get(edge.from);
    const toModule = modulesByFileName.get(edge.to);
    if (!fromModule || !toModule || fromModule.folder === toModule.folder) continue;

    const key = `${fromModule.folder}\0${toModule.folder}\0${edge.kind}`;
    const files = edgeFilesByKey.get(key) ?? new Set<string>();
    files.add(fromModule.fileName);
    edgeFilesByKey.set(key, files);
    edgeMetadataByKey.set(key, {
      from: fromModule.folder,
      to: toModule.folder,
      kind: edge.kind,
    });
  }

  return [...edgeMetadataByKey.entries()]
    .map(([key, edge]) => ({
      ...edge,
      files: [...(edgeFilesByKey.get(key) ?? [])].sort(),
    }))
    .sort((left, right) =>
      `${left.from}/${left.to}/${left.kind}`.localeCompare(
        `${right.from}/${right.to}/${right.kind}`,
      ),
    );
}
