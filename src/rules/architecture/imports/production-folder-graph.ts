import type { FolderEdge, ProjectArchitectureGraph } from "./project-graph/index.js";

export interface ProductionFolderGraph {
  readonly folders: readonly string[];
  readonly edges: readonly FolderEdge[];
}

export function productionFolderGraph(
  graph: ProjectArchitectureGraph,
): ProductionFolderGraph {
  return {
    folders: productionFolderNames(graph),
    edges: productionFolderEdges(graph),
  };
}

function productionFolderEdges(graph: ProjectArchitectureGraph): readonly FolderEdge[] {
  return graph.folderEdges.filter((edge) =>
    edge.files.some((file) => productionFileEdge(graph, file))
  );
}

function productionFileEdge(
  graph: ProjectArchitectureGraph,
  fileName: string,
): boolean {
  const module = graph.modulesByFileName.get(fileName);
  return module !== undefined && !module.isTestLike;
}

function productionFolderNames(graph: ProjectArchitectureGraph): readonly string[] {
  return [...new Set(
    graph.modules
      .filter((module) => !module.isTestLike)
      .map((module) => module.folder),
  )].sort();
}
