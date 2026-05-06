import { checkInventoryBarrels } from "./check-inventory-barrels.js";
import { checkFolderGraph } from "./check-folder-graph.js";
import { checkPackageExports } from "./check-package-exports.js";
import { checkPublicVendorTypeLeaks } from "./check-public-type-leaks.js";
import { checkPublicSurface } from "./check-public-surface.js";
import { uniqueDiagnostics } from "./diagnostics.js";
import { normalizeTopologyOptions } from "./options.js";
import { readPackageJson } from "./package-json.js";
import { buildProjectGraph } from "./project-graph.js";
import {
  createProgram,
  findPackageReportFile,
  projectSourceFiles,
} from "./source-program.js";
import type { TopologyOptions, TopologyReport } from "./types.js";

export function analyzeProjectTopology(options: TopologyOptions = {}): TopologyReport {
  const normalized = normalizeTopologyOptions(options);
  const packageJson = readPackageJson(normalized.projectRoot);
  const program = createProgram(normalized);
  const sourceFiles = program ? projectSourceFiles(program, normalized.projectRoot) : [];
  const packageReportFile = findPackageReportFile(sourceFiles, normalized.projectRoot);
  const graph = buildProjectGraph(sourceFiles, packageJson, normalized, packageReportFile);

  return {
    diagnostics: uniqueDiagnostics([
      ...checkPackageExports(packageJson, normalized, packageReportFile),
      ...checkInventoryBarrels(sourceFiles, normalized),
      ...checkPublicVendorTypeLeaks(program, packageJson, normalized),
      ...checkPublicSurface(graph, sourceFiles, normalized),
      ...checkFolderGraph(graph, normalized),
    ]),
  };
}
