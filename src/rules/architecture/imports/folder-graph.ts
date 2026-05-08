import type {
  FolderEdge,
  LocalModuleEdge,
  ProjectArchitectureGraph,
  SourceModule,
} from "./project-graph/index.js";
import { distantFolderImportDiagnostics } from "./folder-distance.js";
import { productionFolderGraph, type ProductionFolderGraph } from "./production-folder-graph.js";
import type { ArchitectureDiagnostic, ResolvedArchitectureOptions } from "../project/api/index.js";

interface FolderGraphIndex {
  readonly nodes: ReadonlySet<string>;
  readonly adjacency: ReadonlyMap<string, ReadonlySet<string>>;
}

interface TarjanState {
  index: number;
  readonly adjacency: ReadonlyMap<string, ReadonlySet<string>>;
  readonly stack: string[];
  readonly onStack: Set<string>;
  readonly indices: Map<string, number>;
  readonly lowlinks: Map<string, number>;
  readonly components: string[][];
}

interface ModulePair {
  readonly fromModule: SourceModule;
  readonly toModule: SourceModule;
}

export function checkFolderGraph(
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  const productionGraph = productionFolderGraph(graph);
  const components = stronglyConnectedFolderComponents(productionGraph.edges);
  return [
    ...folderCycleDiagnostics(graph, components),
    ...rootInternalCycleDiagnostics(graph, components),
    ...packageMeshDiagnostics(graph, productionGraph, components, options),
    ...distantFolderImportDiagnostics(graph, options),
    ...crossDomainSiblingImportDiagnostics(graph, options),
    ...crossLayerImportDiagnostics(graph, options),
  ];
}

export function stronglyConnectedFolderComponents(
  folderEdges: readonly FolderEdge[],
): readonly (readonly string[])[] {
  const index = folderGraphIndex(folderEdges);
  const state = createTarjanState(index.adjacency);
  for (const node of [...index.nodes].sort()) {
    if (!state.indices.has(node)) connectFolderComponent(state, node);
  }
  return state.components.filter((component) => component.length > 1);
}

function folderGraphIndex(folderEdges: readonly FolderEdge[]): FolderGraphIndex {
  const nodes = new Set<string>();
  const adjacency = new Map<string, Set<string>>();
  for (const edge of folderEdges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
    const neighbors = adjacency.get(edge.from) ?? new Set<string>();
    neighbors.add(edge.to);
    adjacency.set(edge.from, neighbors);
  }
  return { adjacency, nodes };
}

function createTarjanState(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): TarjanState {
  return {
    index: 0,
    adjacency,
    stack: [],
    onStack: new Set<string>(),
    indices: new Map<string, number>(),
    lowlinks: new Map<string, number>(),
    components: [],
  };
}

function connectFolderComponent(state: TarjanState, node: string): void {
  state.indices.set(node, state.index);
  state.lowlinks.set(node, state.index);
  state.index += 1;
  state.stack.push(node);
  state.onStack.add(node);

  for (const neighbor of state.adjacency.get(node) ?? []) {
    visitFolderNeighbor(state, node, neighbor);
  }
  completeFolderComponent(state, node);
}

function visitFolderNeighbor(
  state: TarjanState,
  node: string,
  neighbor: string,
): void {
  if (!state.indices.has(neighbor)) {
    connectFolderComponent(state, neighbor);
    updateLowlink(state, node, state.lowlinks.get(neighbor) ?? 0);
    return;
  }
  if (state.onStack.has(neighbor)) {
    updateLowlink(state, node, state.indices.get(neighbor) ?? 0);
  }
}

function updateLowlink(state: TarjanState, node: string, candidate: number): void {
  state.lowlinks.set(node, Math.min(state.lowlinks.get(node) ?? 0, candidate));
}

function completeFolderComponent(state: TarjanState, node: string): void {
  if (state.lowlinks.get(node) !== state.indices.get(node)) return;
  state.components.push(popFolderComponent(state, node).sort());
}

function popFolderComponent(state: TarjanState, root: string): string[] {
  const component: string[] = [];
  let next = state.stack.pop() ?? null;
  while (next !== null) {
    state.onStack.delete(next);
    component.push(next);
    if (next === root) return component;
    next = state.stack.pop() ?? null;
  }
  return component;
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
  productionGraph: ProductionFolderGraph,
  components: readonly (readonly string[])[],
  options: ResolvedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  if (productionGraph.folders.length < options.minPackageMeshFolders) return [];

  const density = folderEdgeDensity(productionGraph.folders, productionGraph.edges);
  const tooDense = density > options.maxFolderEdgeDensity;
  const tooCyclic = components.length > options.maxFolderCycles;
  if (!tooDense && !tooCyclic) return [];

  return [
    {
      ruleId: "no-package-mesh",
      file: graph.reportFile,
      severity: "warn",
      message:
        `Package folder graph has ${productionGraph.folders.length} production folders, ` +
        `${productionGraph.edges.length} production folder edges, ${components.length} cycle groups, ` +
        `and density ${density.toFixed(2)}. This is a mesh, not a layered package shape.`,
    },
  ];
}

function crossDomainSiblingImportDiagnostics(
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  return graph.localEdges.flatMap((edge) =>
    crossDomainSiblingImportDiagnostic(graph, options, edge)
  );
}

function crossLayerImportDiagnostics(
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  if (options.layers.length === 0) return [];

  return graph.localEdges.flatMap((edge) =>
    crossLayerImportDiagnostic(graph, options, edge)
  );
}

function crossDomainSiblingImportDiagnostic(
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
  edge: LocalModuleEdge,
): readonly ArchitectureDiagnostic[] {
  const pair = importModulePair(graph, edge);
  if (pair === null) return [];
  if (!isCrossDomainSiblingPair(pair, options)) return [];
  if (bothModulesHaveLayers(graph, pair)) return [];
  return [crossDomainSiblingDiagnostic(pair)];
}

function crossLayerImportDiagnostic(
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
  edge: LocalModuleEdge,
): readonly ArchitectureDiagnostic[] {
  const pair = importModulePair(graph, edge);
  if (pair === null || pair.fromModule.isTestLike) return [];
  const fromLayer = moduleLayer(graph, pair.fromModule);
  const toLayer = moduleLayer(graph, pair.toModule);
  if (fromLayer === null || toLayer === null || fromLayer <= toLayer) return [];
  return [crossLayerDiagnostic(pair, options, fromLayer, toLayer)];
}

function importModulePair(
  graph: ProjectArchitectureGraph,
  edge: LocalModuleEdge,
): ModulePair | null {
  if (edge.kind !== "import") return null;
  const fromModule = graph.modulesByFileName.get(edge.from);
  const toModule = graph.modulesByFileName.get(edge.to);
  return fromModule && toModule ? { fromModule, toModule } : null;
}

function isCrossDomainSiblingPair(
  pair: ModulePair,
  options: ResolvedArchitectureOptions,
): boolean {
  if (pair.fromModule.isTestLike || pair.toModule.isTestLike) return false;
  if (pair.fromModule.topFolder === "." || pair.toModule.topFolder === ".") return false;
  if (pair.fromModule.topFolder === pair.toModule.topFolder) return false;
  return !sharedFolder(options, pair.fromModule.topFolder) &&
    !sharedFolder(options, pair.toModule.topFolder);
}

function bothModulesHaveLayers(
  graph: ProjectArchitectureGraph,
  pair: ModulePair,
): boolean {
  return moduleLayer(graph, pair.fromModule) !== null &&
    moduleLayer(graph, pair.toModule) !== null;
}

function moduleLayer(
  graph: ProjectArchitectureGraph,
  module: SourceModule,
): number | null {
  return graph.folderLayerIndex.get(module.folder) ?? null;
}

function crossDomainSiblingDiagnostic(
  pair: ModulePair,
): ArchitectureDiagnostic {
  return {
    ruleId: "no-cross-domain-sibling-import",
    file: pair.fromModule.fileName,
    severity: "warn",
    message:
      `${pair.fromModule.relativePath} imports ${pair.toModule.relativePath} across sibling ` +
      `domains (${pair.fromModule.topFolder} -> ${pair.toModule.topFolder}). ` +
      "Sibling features should meet through a facade, registry, or shared kernel.",
  };
}

function crossLayerDiagnostic(
  pair: ModulePair,
  options: ResolvedArchitectureOptions,
  fromLayer: number,
  toLayer: number,
): ArchitectureDiagnostic {
  const fromLayerName = options.layers[fromLayer]?.name ?? `layer ${fromLayer}`;
  const toLayerName = options.layers[toLayer]?.name ?? `layer ${toLayer}`;
  return {
    ruleId: "no-upward-layer-import",
    file: pair.fromModule.fileName,
    severity: "warn",
    message:
      `${pair.fromModule.relativePath} (layer '${fromLayerName}') imports upward into ` +
      `${pair.toModule.relativePath} (layer '${toLayerName}'). ` +
      "Lower-numbered layers must not depend on higher-numbered ones; move the shared " +
      "contract into a deeper layer or invert the dependency.",
  };
}

function sharedFolder(
  options: ResolvedArchitectureOptions,
  folderName: string,
): boolean {
  return options.sharedFolderNames.some((entry) => entry.folder === folderName);
}
