import { implicitBoundaryModuleDiagnostics } from "./implicit-boundary.js";
import { sharedKernelCohesionDiagnostics } from "./shared-kernel-cohesion.js";
import { uniqueDiagnostics } from "../project/api/index.js";
import type { ProjectArchitectureGraph } from "../imports/index.js";
import type { ArchitectureDiagnostic, ResolvedArchitectureOptions } from "../project/api/index.js";

export function checkModuleShape(
  graph: ProjectArchitectureGraph,
  options: ResolvedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  return uniqueDiagnostics([
    ...implicitBoundaryModuleDiagnostics(graph, options),
    ...sharedKernelCohesionDiagnostics(graph, options),
  ]);
}
