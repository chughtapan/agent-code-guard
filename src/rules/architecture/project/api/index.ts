export {
  ArchitectureOptionsError,
  architectureOptionsJsonSchema,
  resolveArchitectureOptions,
  type ArchitectureOptionsInput,
} from "../config.js";
export { cachedProjectArchitecture, clearArchitectureCache } from "../cache.js";
export {
  SOURCE_EXTENSIONS,
  candidateFileNames,
  stripKnownExtension,
} from "../source-paths.js";
export {
  createProgram,
  findPackageReportFile,
  projectSourceFiles,
  publicApiSourceFiles,
} from "../source-files.js";
export { collectExportsValue, collectPackageExportEntries } from "../package-exports/index.js";
export { emptyPackageJson, readPackageJson } from "../package-json.js";
export { uniqueDiagnostics } from "../diagnostics/index.js";
export type {
  ArchitectureDiagnostic,
  ArchitectureDiagnosticRuleId,
  ArchitectureReport,
  ArchitectureSeverity,
  LayerDefinition,
  PackageExportEntry,
  PackageJson,
  ResolvedArchitectureOptions,
} from "../diagnostics/index.js";
