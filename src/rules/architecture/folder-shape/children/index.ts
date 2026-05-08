import path from "node:path";
import {
  explicitFacadeModule,
  generatedModule,
  type ProjectArchitectureGraph,
  type SourceModule,
} from "../../project/index.js";
import {
  stripKnownExtension,
  type ResolvedArchitectureOptions,
} from "../../project/api/index.js";

interface MutableFolderChildren {
  readonly folder: string;
  readonly productionChildren: Set<string>;
  readonly testChildren: Set<string>;
  readonly files: Set<string>;
}

export interface FolderChildren {
  readonly folder: string;
  readonly productionChildren: ReadonlySet<string>;
  readonly testChildren: ReadonlySet<string>;
  readonly files: ReadonlySet<string>;
}

export function folderChildren(
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
): readonly FolderChildren[] {
  const byFolder = new Map<string, MutableFolderChildren>();
  for (const module of graph.modules) addModuleChildren(byFolder, module, options);
  return [...byFolder.values()].sort(compareFolderChildren);
}

function addModuleChildren(
  byFolder: Map<string, MutableFolderChildren>,
  module: SourceModule,
  options: ResolvedArchitectureOptions,
): void {
  if (generatedModule(module)) return;
  const folderSegments = module.folder === "." ? [] : module.folder.split("/");
  addAncestorFolderChildren(byFolder, module, folderSegments);
  if (!explicitFacadeModule(module, options)) addDirectFileChild(byFolder, module);
}

function addAncestorFolderChildren(
  byFolder: Map<string, MutableFolderChildren>,
  module: SourceModule,
  folderSegments: readonly string[],
): void {
  for (let index = 0; index < folderSegments.length; index += 1) {
    const child = folderSegments[index];
    if (child !== undefined) {
      addChild(byFolder, folderFromSegments(folderSegments.slice(0, index)), child, module);
    }
  }
}

function addDirectFileChild(
  byFolder: Map<string, MutableFolderChildren>,
  module: SourceModule,
): void {
  addChild(byFolder, module.folder, fileChildName(module), module);
}

function addChild(
  byFolder: Map<string, MutableFolderChildren>,
  folder: string,
  child: string,
  module: SourceModule,
): void {
  const children = mutableFolderChildren(byFolder, folder);
  const target = module.isTestLike ? children.testChildren : children.productionChildren;
  target.add(child);
  children.files.add(module.fileName);
}

function mutableFolderChildren(
  byFolder: Map<string, MutableFolderChildren>,
  folder: string,
): MutableFolderChildren {
  const existing = byFolder.get(folder);
  if (existing) return existing;
  const children = {
    folder,
    productionChildren: new Set<string>(),
    testChildren: new Set<string>(),
    files: new Set<string>(),
  };
  byFolder.set(folder, children);
  return children;
}

function fileChildName(module: SourceModule): string {
  const fileStem = stripKnownExtension(path.basename(module.fileName));
  return module.isTestLike ? stripTestSuffix(fileStem) : fileStem;
}

function stripTestSuffix(fileStem: string): string {
  return fileStem.replace(/\.(test|spec)$/, "");
}

function folderFromSegments(segments: readonly string[]): string {
  return segments.length === 0 ? "." : segments.join("/");
}

function compareFolderChildren(
  left: FolderChildren,
  right: FolderChildren,
): number {
  return left.folder.localeCompare(right.folder);
}

export function firstSorted(values: ReadonlySet<string>): string | null {
  return [...values].sort()[0] ?? null;
}

export function sourceFolderPath(folder: string): string {
  return folder === "." ? "src" : `src/${folder}`;
}
