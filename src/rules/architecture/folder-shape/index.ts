import { uniqueDiagnostics } from "../project/api/index.js";
import { explicitFolderApiDiagnostics } from "./explicit-api.js";
import { folderChildLimitDiagnostics } from "./large-folder.js";
import { folderReadmeRequiredDiagnostics } from "./readme-required.js";
import type { ProjectArchitectureGraph } from "../imports/index.js";
import type { ArchitectureDiagnostic, ResolvedArchitectureOptions } from "../project/api/index.js";

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
