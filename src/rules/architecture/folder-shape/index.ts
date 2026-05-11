/**
 * @file Folder-shape analysis barrel. Composes the per-rule folder
 * shape checks (child-count budget, README requirement, explicit-API
 * requirement) into a single project-level diagnostic pass.
 */

import { uniqueDiagnostics } from "../project/api/index.js";
import { explicitFolderApiDiagnostics } from "./explicit-api.js";
import { folderChildLimitDiagnostics } from "./large-folder.js";
import { folderReadmeRequiredDiagnostics } from "./readme-required.js";
import type { ProjectArchitectureGraph } from "../imports/index.js";
import type { ArchitectureDiagnostic, ResolvedArchitectureOptions } from "../project/api/index.js";

/**
 * Run every folder-shape architecture check (child-count budget, README
 * requirement, explicit-API requirement) against the project graph and
 * return a deduplicated diagnostic list.
 * @param graph Project architecture graph (modules, folders, edges).
 * @param options Resolved architecture rule options with policy lists.
 * @returns Deduplicated diagnostics; empty array when the folder layer
 * is healthy.
 */
export function checkFolderShape(
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  return uniqueDiagnostics([
    ...folderChildLimitDiagnostics(graph, options),
    ...folderReadmeRequiredDiagnostics(graph, options),
    ...explicitFolderApiDiagnostics(graph, options),
  ]);
}
