import path from "node:path";
import type {
  FolderEdge,
  ProjectArchitectureGraph,
  SourceModule,
} from "./project-graph.js";
import type { NormalizedArchitectureOptions, ArchitectureDiagnostic } from "./types.js";

export function checkFolderGraph(
  graph: ProjectArchitectureGraph,
  options: NormalizedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  const components = stronglyConnectedFolderComponents(graph.folderEdges);
  return [
    ...folderCycleDiagnostics(graph, components),
    ...rootInternalCycleDiagnostics(graph, components),
    ...packageMeshDiagnostics(graph, components, options),
    ...crossDomainSiblingImportDiagnostics(graph, options),
    ...upwardLayerImportDiagnostics(graph),
  ];
}

export function stronglyConnectedFolderComponents(
  folderEdges: readonly FolderEdge[],
): readonly (readonly string[])[] {
  const nodes = new Set<string>();
  const adjacency = new Map<string, Set<string>>();

  for (const edge of folderEdges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
    const neighbors = adjacency.get(edge.from) ?? new Set<string>();
    neighbors.add(edge.to);
    adjacency.set(edge.from, neighbors);
  }

  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const components: string[][] = [];

  const connect = (node: string): void => {
    indices.set(node, index);
    lowlinks.set(node, index);
    index += 1;
    stack.push(node);
    onStack.add(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      if (!indices.has(neighbor)) {
        connect(neighbor);
        lowlinks.set(
          node,
          Math.min(lowlinks.get(node) ?? 0, lowlinks.get(neighbor) ?? 0),
        );
        continue;
      }

      if (onStack.has(neighbor)) {
        lowlinks.set(
          node,
          Math.min(lowlinks.get(node) ?? 0, indices.get(neighbor) ?? 0),
        );
      }
    }

    if (lowlinks.get(node) !== indices.get(node)) return;

    const component: string[] = [];
    for (;;) {
      const next = stack.pop();
      if (next === undefined) break;
      onStack.delete(next);
      component.push(next);
      if (next === node) break;
    }
    components.push(component.sort());
  };

  for (const node of [...nodes].sort()) {
    if (!indices.has(node)) connect(node);
  }

  return components.filter((component) => component.length > 1);
}

export function folderEdgeDensity(
  folders: readonly string[],
  folderEdges: readonly FolderEdge[],
): number {
  if (folders.length < 2) return 0;

  const uniqueDirections = new Set(
    folderEdges.map((edge) => `${edge.from}\0${edge.to}`),
  );
  return uniqueDirections.size / (folders.length * (folders.length - 1));
}

function folderCycleDiagnostics(
  graph: ProjectArchitectureGraph,
  components: readonly (readonly string[])[],
): readonly ArchitectureDiagnostic[] {
  return components.map((component) => ({
    ruleId: "no-folder-cycle",
    file: graph.reportFile,
    severity: "warn",
    message:
      `Folder dependency cycle: ${component.join(" <-> ")}. ` +
      "Folders should expose a stable direction of knowledge; cycles make every " +
      "folder in the component part of the same abstraction.",
  }));
}

function rootInternalCycleDiagnostics(
  graph: ProjectArchitectureGraph,
  components: readonly (readonly string[])[],
): readonly ArchitectureDiagnostic[] {
  const hasCycle = components.some(
    (component) => component.includes(".") && component.includes("internal"),
  );
  if (!hasCycle) return [];

  return [
    {
      ruleId: "no-root-internal-cycle",
      file: graph.reportFile,
      severity: "error",
      message:
        "Root files and internal files depend on each other. The public/root layer " +
        "should hide internal decisions; internal code should not import back through it.",
    },
  ];
}

function packageMeshDiagnostics(
  graph: ProjectArchitectureGraph,
  components: readonly (readonly string[])[],
  options: NormalizedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  if (graph.folders.length < options.minPackageMeshFolders) return [];

  const density = folderEdgeDensity(graph.folders, graph.folderEdges);
  const tooDense = density > options.maxFolderEdgeDensity;
  const tooCyclic = components.length > options.maxFolderCycles;
  if (!tooDense && !tooCyclic) return [];

  return [
    {
      ruleId: "no-package-mesh",
      file: graph.reportFile,
      severity: "warn",
      message:
        `Package folder graph has ${graph.folders.length} folders, ` +
        `${graph.folderEdges.length} folder edges, ${components.length} cycle groups, ` +
        `and density ${density.toFixed(2)}. This is a mesh, not a layered package shape.`,
    },
  ];
}

function crossDomainSiblingImportDiagnostics(
  graph: ProjectArchitectureGraph,
  options: NormalizedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  return graph.localEdges.flatMap((edge) => {
    if (edge.kind !== "import") return [];

    const fromModule = graph.modulesByFileName.get(edge.from);
    const toModule = graph.modulesByFileName.get(edge.to);
    if (!fromModule || !toModule) return [];
    if (fromModule.isTestLike || toModule.isTestLike) return [];
    if (fromModule.topFolder === "." || toModule.topFolder === ".") return [];
    if (fromModule.topFolder === toModule.topFolder) return [];
    if (sharedFolder(options, fromModule.topFolder) || sharedFolder(options, toModule.topFolder)) {
      return [];
    }

    return [
      {
        ruleId: "no-cross-domain-sibling-import",
        file: fromModule.fileName,
        severity: "warn",
        message:
          `${fromModule.relativePath} imports ${toModule.relativePath} across sibling ` +
          `domains (${fromModule.topFolder} -> ${toModule.topFolder}). ` +
          "Sibling features should meet through a facade, registry, or shared kernel.",
      },
    ];
  });
}

function upwardLayerImportDiagnostics(
  graph: ProjectArchitectureGraph,
): readonly ArchitectureDiagnostic[] {
  return graph.localEdges.flatMap((edge) => {
    if (edge.kind !== "import") return [];

    const fromModule = graph.modulesByFileName.get(edge.from);
    const toModule = graph.modulesByFileName.get(edge.to);
    if (!fromModule || !toModule || fromModule.isTestLike) return [];
    if (!importsUpward(fromModule, toModule)) return [];

    return [
      {
        ruleId: "no-upward-layer-import",
        file: fromModule.fileName,
        severity: "warn",
        message:
          `${fromModule.relativePath} imports upward into ${toModule.relativePath}. ` +
          "Lower-level files should not depend on parent/root facades; move the shared " +
          "contract down or inject it from the entrypoint.",
      },
    ];
  });
}

function importsUpward(fromModule: SourceModule, toModule: SourceModule): boolean {
  if (fromModule.folder === toModule.folder) return false;
  if (!toModule.isIndex && toModule.folder !== ".") return false;
  if (toModule.folder === ".") return fromModule.folder !== ".";

  const fromFolder = path.posix.normalize(fromModule.folder);
  const toFolder = path.posix.normalize(toModule.folder);
  return fromFolder.startsWith(`${toFolder}/`);
}

function sharedFolder(
  options: NormalizedArchitectureOptions,
  folderName: string,
): boolean {
  return options.sharedFolderNames.includes(folderName);
}
