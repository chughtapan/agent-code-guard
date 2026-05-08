import path from "node:path";
import { checkFolderShape } from "./folder-shape/index.js";
import { checkInventoryBarrels } from "./exports/inventory-barrels.js";
import { buildProjectGraph, checkFolderGraph } from "./imports/index.js";
import { checkModuleShape } from "./module-shape/index.js";
import {
  checkPackageExports,
  checkPublicSurface,
  emptyPackageJson,
  readPackageJson,
} from "./package-api/index.js";
import {
  createProgram,
  findPackageReportFile,
  projectSourceFiles,
  resolveArchitectureOptions,
  uniqueDiagnostics,
} from "./project/api/index.js";
import { checkPublicVendorTypeLeaks } from "./type-surface/index.js";
import {
  buildDirectiveIndex,
  isDirectiveSuppressed,
  parseDirectivesFromSourceFile,
  type FileDirectives,
} from "./architecture-exceptions.js";
import { ARCHITECTURE_DIRECTIVE_PARSE_ERROR_RULE_ID } from "./rule-ids.js";
import type {
  ArchitectureDiagnostic,
  ArchitectureDiagnosticRuleId,
  ArchitectureReport,
  ResolvedArchitectureOptions,
} from "./project/api/index.js";

interface DirectiveAnalysis {
  readonly directiveErrorDiagnostics: readonly ArchitectureDiagnostic[];
  readonly directiveIndex: ReadonlyMap<string, ReadonlySet<ArchitectureDiagnosticRuleId>>;
  readonly attemptedSuppressions: ReadonlyMap<string, ReadonlySet<ArchitectureDiagnosticRuleId>>;
}

// Internal: assumes options have already been schema-decoded and path-resolved.
// Used by the cache layer to avoid double decoding.
export function analyzeResolvedArchitecture(
  options: ResolvedArchitectureOptions,
): ArchitectureReport {
  const packageJson = readPackageJson(options.projectRoot) ?? emptyPackageJson();
  const program = createProgram(options);
  const sourceFiles = program ? projectSourceFiles(program, options.projectRoot) : [];
  const packageReportFile = findPackageReportFile(sourceFiles, options.projectRoot);
  const graph = buildProjectGraph(sourceFiles, packageJson, options, packageReportFile);
  const directiveAnalysis = analyzeDirectiveComments(sourceFiles);

  const allDiagnostics = uniqueDiagnostics([
    ...checkPackageExports(packageJson, options, packageReportFile),
    ...checkInventoryBarrels(sourceFiles, options),
    ...resolvePublicVendorTypeLeaks(program, packageJson, options),
    ...checkPublicSurface(graph, sourceFiles, options),
    ...checkFolderGraph(graph, options),
    ...checkFolderShape(graph, options),
    ...checkModuleShape(graph, options),
  ]);

  return {
    diagnostics: [
      ...directiveAnalysis.directiveErrorDiagnostics,
      ...filterSuppressedDiagnostics(allDiagnostics, directiveAnalysis),
    ],
  };
}

function resolvePublicVendorTypeLeaks(
  program: ReturnType<typeof createProgram>,
  packageJson: ReturnType<typeof emptyPackageJson>,
  options: ResolvedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  return program === null ? [] : checkPublicVendorTypeLeaks(program, packageJson, options);
}

function analyzeDirectiveComments(
  sourceFiles: readonly ReturnType<typeof projectSourceFiles>[number][],
): DirectiveAnalysis {
  const fileDirectives: FileDirectives[] = [];
  const directiveErrorDiagnostics: ArchitectureDiagnostic[] = [];
  const attemptedSuppressions = new Map<string, Set<ArchitectureDiagnosticRuleId>>();

  for (const sourceFile of sourceFiles) {
    const result = parseDirectivesFromSourceFile(sourceFile);
    const resolvedFile = path.resolve(sourceFile.fileName);
    if (result.directives.length > 0) {
      fileDirectives.push({ file: resolvedFile, directives: result.directives });
    }
    for (const err of result.errors) {
      directiveErrorDiagnostics.push(directiveParseDiagnostic(resolvedFile, err));
      if (err.ruleId !== null) {
        recordAttemptedSuppression(attemptedSuppressions, resolvedFile, err.ruleId);
      }
    }
  }
  return {
    attemptedSuppressions,
    directiveErrorDiagnostics,
    directiveIndex: buildDirectiveIndex(fileDirectives),
  };
}

function directiveParseDiagnostic(
  resolvedFile: string,
  error: { readonly line: number; readonly message: string },
): ArchitectureDiagnostic {
  return {
    ruleId: ARCHITECTURE_DIRECTIVE_PARSE_ERROR_RULE_ID,
    file: resolvedFile,
    severity: "error",
    message: `Architecture directive parse error (line ${error.line}): ${error.message}`,
  };
}

function recordAttemptedSuppression(
  attemptedSuppressions: Map<string, Set<ArchitectureDiagnosticRuleId>>,
  resolvedFile: string,
  ruleId: ArchitectureDiagnosticRuleId,
): void {
  const set = attemptedSuppressions.get(resolvedFile) ?? new Set();
  set.add(ruleId);
  attemptedSuppressions.set(resolvedFile, set);
}

function filterSuppressedDiagnostics(
  diagnostics: readonly ArchitectureDiagnostic[],
  directiveAnalysis: DirectiveAnalysis,
): readonly ArchitectureDiagnostic[] {
  return diagnostics.filter((diagnostic) =>
    shouldKeepDiagnostic(diagnostic, directiveAnalysis)
  );
}

function shouldKeepDiagnostic(
  diagnostic: ArchitectureDiagnostic,
  directiveAnalysis: DirectiveAnalysis,
): boolean {
  if (diagnostic.ruleId === ARCHITECTURE_DIRECTIVE_PARSE_ERROR_RULE_ID) return true;
  const ruleId = diagnostic.ruleId as ArchitectureDiagnosticRuleId;
  const resolvedFile = path.resolve(diagnostic.file);
  if (isDirectiveSuppressed(directiveAnalysis.directiveIndex, resolvedFile, ruleId)) {
    return false;
  }
  return !directiveAnalysis.attemptedSuppressions.get(resolvedFile)?.has(ruleId);
}

// Public entry: takes raw user input, decodes via schema, resolves path
// fields, then runs analysis. Used by tests and any caller who has not
// already resolved options. The rule path uses cachedProjectArchitecture
// instead so it doesn't re-resolve.
export function analyzeProjectArchitecture(options: unknown = {}): ArchitectureReport {
  return analyzeResolvedArchitecture(resolveArchitectureOptions(options));
}
