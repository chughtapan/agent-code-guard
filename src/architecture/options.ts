import path from "node:path";
import {
  DEFAULT_ARCHITECTURE_OPTIONS,
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
      DEFAULT_ARCHITECTURE_OPTIONS.minExportedSiblingModules,
    maxExportedSiblingRatio:
      options.maxExportedSiblingRatio ??
      DEFAULT_ARCHITECTURE_OPTIONS.maxExportedSiblingRatio,
    countTypeOnlyExports:
      options.countTypeOnlyExports ?? DEFAULT_ARCHITECTURE_OPTIONS.countTypeOnlyExports,
    allowedPublicSubpaths:
      options.allowedPublicSubpaths ?? DEFAULT_ARCHITECTURE_OPTIONS.allowedPublicSubpaths,
    allowedTestPublicSubpaths:
      options.allowedTestPublicSubpaths ??
      DEFAULT_ARCHITECTURE_OPTIONS.allowedTestPublicSubpaths,
    forbiddenSubpathSegments:
      options.forbiddenSubpathSegments ??
      DEFAULT_ARCHITECTURE_OPTIONS.forbiddenSubpathSegments,
    implementationPathSegments:
      options.implementationPathSegments ??
      DEFAULT_ARCHITECTURE_OPTIONS.implementationPathSegments,
    maxSubpathExports:
      options.maxSubpathExports ?? DEFAULT_ARCHITECTURE_OPTIONS.maxSubpathExports,
    maxWildcardExports:
      options.maxWildcardExports ?? DEFAULT_ARCHITECTURE_OPTIONS.maxWildcardExports,
    maxPublicExports:
      options.maxPublicExports ?? DEFAULT_ARCHITECTURE_OPTIONS.maxPublicExports,
    maxPublicReexports:
      options.maxPublicReexports ?? DEFAULT_ARCHITECTURE_OPTIONS.maxPublicReexports,
    minPublicFacadeModules:
      options.minPublicFacadeModules ?? DEFAULT_ARCHITECTURE_OPTIONS.minPublicFacadeModules,
    minPackageMeshFolders:
      options.minPackageMeshFolders ?? DEFAULT_ARCHITECTURE_OPTIONS.minPackageMeshFolders,
    maxFolderEdgeDensity:
      options.maxFolderEdgeDensity ?? DEFAULT_ARCHITECTURE_OPTIONS.maxFolderEdgeDensity,
    maxFolderCycles:
      options.maxFolderCycles ?? DEFAULT_ARCHITECTURE_OPTIONS.maxFolderCycles,
    sharedFolderNames:
      options.sharedFolderNames ?? DEFAULT_ARCHITECTURE_OPTIONS.sharedFolderNames,
    infrastructureTypePackages:
      options.infrastructureTypePackages ??
      DEFAULT_ARCHITECTURE_OPTIONS.infrastructureTypePackages,
    publicTypePackages:
      options.publicTypePackages ?? DEFAULT_ARCHITECTURE_OPTIONS.publicTypePackages,
    packageRuntime: options.packageRuntime ?? DEFAULT_ARCHITECTURE_OPTIONS.packageRuntime,
  };
}
