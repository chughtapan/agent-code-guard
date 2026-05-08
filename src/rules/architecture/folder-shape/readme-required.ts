import fs from "node:fs";
import path from "node:path";
import {
  firstSorted,
  folderChildren,
  sourceFolderPath,
  type FolderChildren,
} from "./children/index.js";
import type { ProjectArchitectureGraph } from "../imports/index.js";
import type { ArchitectureDiagnostic, ResolvedArchitectureOptions } from "../project/api/index.js";

export function folderReadmeRequiredDiagnostics(
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  return folderChildren(graph, options).flatMap((children) =>
    folderReadmeRequiredDiagnostic(children, graph, options)
  );
}

function folderReadmeRequiredDiagnostic(
  children: FolderChildren,
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  if (children.productionChildren.size < options.minFolderReadmeChildren) return [];
  if (folderHasReadme(graph, children.folder, options)) return [];
  return [missingReadmeDiagnostic(children, graph, options)];
}

function folderHasReadme(
  graph: ProjectArchitectureGraph,
  folder: string,
  options: ResolvedArchitectureOptions,
): boolean {
  const directory = path.join(graph.projectRoot, sourceFolderPath(folder));
  return options.folderReadmeFileNames.some((fileName) =>
    fs.existsSync(path.join(directory, fileName))
  );
}

function missingReadmeDiagnostic(
  children: FolderChildren,
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
): ArchitectureDiagnostic {
  const folderPath = sourceFolderPath(children.folder);
  const readmeName = options.folderReadmeFileNames[0] ?? "README.md";
  return {
    ruleId: "folder-readme-required",
    file: firstSorted(children.files) ?? graph.reportFile,
    severity: "warn",
    message:
      `${folderPath} has ${children.productionChildren.size} direct semantic children ` +
      `(threshold ${options.minFolderReadmeChildren}) but no configured README file. ` +
      `Add ${folderPath}/${readmeName} describing the folder boundary, or split the folder.`,
  };
}
