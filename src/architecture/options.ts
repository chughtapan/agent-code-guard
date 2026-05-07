import path from "node:path";
import {
  DEFAULT_TOPOLOGY_OPTIONS,
  type NormalizedArchitectureOptions,
  type ArchitectureOptions,
} from "./types.js";

export function normalizeArchitectureOptions(
  options: ArchitectureOptions = {},
): NormalizedArchitectureOptions {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());

  return {
    projectRoot,
    tsconfigPath: options.tsconfigPath
      ? path.resolve(projectRoot, options.tsconfigPath)
      : null,
    minExportedSiblingModules:
      options.minExportedSiblingModules ??
      DEFAULT_TOPOLOGY_OPTIONS.minExportedSiblingModules,
    maxExportedSiblingRatio:
      options.maxExportedSiblingRatio ??
      DEFAULT_TOPOLOGY_OPTIONS.maxExportedSiblingRatio,
    countTypeOnlyExports:
      options.countTypeOnlyExports ?? DEFAULT_TOPOLOGY_OPTIONS.countTypeOnlyExports,
    allowedPublicSubpaths:
      options.allowedPublicSubpaths ?? DEFAULT_TOPOLOGY_OPTIONS.allowedPublicSubpaths,
    allowedTestPublicSubpaths:
      options.allowedTestPublicSubpaths ??
      DEFAULT_TOPOLOGY_OPTIONS.allowedTestPublicSubpaths,
    forbiddenSubpathSegments:
      options.forbiddenSubpathSegments ??
      DEFAULT_TOPOLOGY_OPTIONS.forbiddenSubpathSegments,
    implementationPathSegments:
      options.implementationPathSegments ??
      DEFAULT_TOPOLOGY_OPTIONS.implementationPathSegments,
    maxSubpathExports:
      options.maxSubpathExports ?? DEFAULT_TOPOLOGY_OPTIONS.maxSubpathExports,
    maxWildcardExports:
      options.maxWildcardExports ?? DEFAULT_TOPOLOGY_OPTIONS.maxWildcardExports,
    maxPublicExports:
      options.maxPublicExports ?? DEFAULT_TOPOLOGY_OPTIONS.maxPublicExports,
    maxPublicReexports:
      options.maxPublicReexports ?? DEFAULT_TOPOLOGY_OPTIONS.maxPublicReexports,
    minPublicFacadeModules:
      options.minPublicFacadeModules ?? DEFAULT_TOPOLOGY_OPTIONS.minPublicFacadeModules,
    minPackageMeshFolders:
      options.minPackageMeshFolders ?? DEFAULT_TOPOLOGY_OPTIONS.minPackageMeshFolders,
    maxFolderEdgeDensity:
      options.maxFolderEdgeDensity ?? DEFAULT_TOPOLOGY_OPTIONS.maxFolderEdgeDensity,
    maxFolderCycles:
      options.maxFolderCycles ?? DEFAULT_TOPOLOGY_OPTIONS.maxFolderCycles,
    sharedFolderNames:
      options.sharedFolderNames ?? DEFAULT_TOPOLOGY_OPTIONS.sharedFolderNames,
    infrastructureTypePackages:
      options.infrastructureTypePackages ??
      DEFAULT_TOPOLOGY_OPTIONS.infrastructureTypePackages,
    publicTypePackages:
      options.publicTypePackages ?? DEFAULT_TOPOLOGY_OPTIONS.publicTypePackages,
    packageRuntime: options.packageRuntime ?? DEFAULT_TOPOLOGY_OPTIONS.packageRuntime,
  };
}
