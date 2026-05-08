import path from "node:path";
import ts from "typescript";
import { collectModuleEdges } from "../edges.js";
import {
  collectExportConsumers,
  collectExportedSymbolNames,
} from "../module-symbols.js";
import { collectFolderEdges } from "../folder-edges.js";
import { publicApiFileNames } from "../../package-api/index.js";
import {
  hasExportModifier,
  isStarExportDeclaration,
  isTestLikePath,
  normalizePath,
  type ExportConsumer,
  type ProjectArchitectureGraph,
  type SourceModule,
} from "../../project/index.js";
import { withTrailingSeparator } from "../../project/source-paths.js";
import type { LayerDefinition, PackageJson, ResolvedArchitectureOptions } from "../../project/api/index.js";

export { resolveLocalSpecifier } from "../specifier-resolution.js";
export type {
  ExportConsumer,
  ExternalModuleEdge,
  FolderEdge,
  LocalModuleEdge,
  ModuleEdgeKind,
  ProjectArchitectureGraph,
  SourceModule,
} from "../../project/index.js";

export function buildProjectGraph(
  sourceFiles: readonly ts.SourceFile[],
  packageJson: PackageJson,
  options: ResolvedArchitectureOptions,
  reportFile: string,
): ProjectArchitectureGraph {
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
  const exportConsumers = collectExportConsumers(sourceFiles, sourceFilesByPath);
  const publicModules = modules.filter((module) => module.isPublic);
  const folders = [...new Set(modules.map((module) => module.folder))].sort();

  const folderLayerIndex = new Map<string, number | null>(
    folders.map((folder) => [folder, layerIndexFor(folder, options.layers)] as const),
  );

  return {
    projectRoot: options.projectRoot,
    reportFile,
    modules,
    modulesByFileName,
    publicModules,
    localEdges,
    externalEdges,
    exportConsumers,
    exportConsumersByFileName: consumersByTargetFile(exportConsumers),
    folderEdges: collectFolderEdges(localEdges, modulesByFileName),
    folders,
    folderLayerIndex,
  };
}

// Returns the index of the layer the folder belongs to, or null if no layer
// matches. Match rule: a folder belongs to a layer if any of the layer's
// `folders` entries equals the folder OR is a path prefix of it (segment
// boundary). Among matches, the longest entry wins (most-specific). Ties on
// length resolve to the lower (earlier) layer index for predictability.
export function layerIndexFor(
  folder: string,
  layers: ReadonlyArray<LayerDefinition>,
): number | null {
  if (layers.length === 0) return null;
  const normalized = folder === "." ? "" : normalizePath(folder);

  let bestLayer: number | null = null;
  let bestEntryLength = -1;

  layers.forEach((layer, layerIndex) => {
    for (const entry of layer.folders) {
      const normalizedEntry = entry === "." ? "" : normalizePath(entry);
      const matches =
        normalizedEntry === normalized ||
        (normalizedEntry !== "" && normalized.startsWith(`${normalizedEntry}/`));
      if (!matches) continue;
      if (normalizedEntry.length > bestEntryLength) {
        bestEntryLength = normalizedEntry.length;
        bestLayer = layerIndex;
      }
    }
  });

  return bestLayer;
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
  return folder.split("/")[0] ?? ".";
}

function sourceModuleFromSourceFile(
  sourceFile: ts.SourceFile,
  sourceFilesByPath: ReadonlyMap<string, ts.SourceFile>,
  publicFileNames: ReadonlySet<string>,
  options: ResolvedArchitectureOptions,
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
    exportedSymbols: collectExportedSymbolNames(sourceFile),
    exportedSymbolCount: countExportedSymbols(sourceFile),
    localReexportCount: edges.localEdges.filter((edge) => edge.kind === "reexport").length,
    starExportCount: sourceFile.statements.filter(isStarExportDeclaration).length,
    topLevelStatementCount: countNonImportTopLevelStatements(sourceFile),
  };
}

function countNonImportTopLevelStatements(sourceFile: ts.SourceFile): number {
  return sourceFile.statements.reduce((count, statement) => {
    if (ts.isImportDeclaration(statement)) return count;
    if (ts.isImportEqualsDeclaration(statement)) return count;
    return count + 1;
  }, 0);
}

function consumersByTargetFile(
  exportConsumers: readonly ExportConsumer[],
): ReadonlyMap<string, readonly ExportConsumer[]> {
  const grouped = new Map<string, ExportConsumer[]>();
  for (const consumer of exportConsumers) {
    const consumers = grouped.get(consumer.targetFile) ?? [];
    consumers.push(consumer);
    grouped.set(consumer.targetFile, consumers);
  }
  return grouped;
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
