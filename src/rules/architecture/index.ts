/**
 * @file Architecture rule entry point. Composes every analysis pass
 * (package exports, inventory barrels, vendor type leaks, public
 * surface, folder graph, folder/module shape) into the single project
 * report consumed by the architecture ESLint rules.
 */

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

/**
 * Run every architecture analysis pass (package exports, inventory
 * barrels, public vendor type leaks, public surface, folder graph,
 * folder shape, module shape) against pre-resolved options and return
 * the merged report with directive-based suppressions applied. Used by
 * the cache layer so options are not re-decoded on every rule.
 * @param options Pre-resolved architecture options (already
 * schema-decoded and path-resolved).
 * @returns The combined architecture report with deduplicated
 * diagnostics, after directive suppressions are applied.
 */
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

  const diagnostics = [
    ...directiveAnalysis.directiveErrorDiagnostics,
    ...filterSuppressedDiagnostics(allDiagnostics, directiveAnalysis),
  ];
  return { diagnostics, diagnosticsByFile: indexByFile(diagnostics) };
}

function indexByFile(
  diagnostics: readonly ArchitectureDiagnostic[],
): ReadonlyMap<string, readonly ArchitectureDiagnostic[]> {
  const byFile = new Map<string, ArchitectureDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    const bucket = byFile.get(diagnostic.file);
    if (bucket === undefined) byFile.set(diagnostic.file, [diagnostic]);
    else bucket.push(diagnostic);
  }
  return byFile;
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

/**
 * Public entry: decode raw user options, resolve paths, and run the
 * full architecture analysis. The rule path uses
 * `cachedProjectArchitecture` instead so options are not re-resolved on
 * every rule invocation; this entry is for tests and callers that have
 * not pre-resolved options.
 * @param options Raw architecture options object from user config
 * (defaults to `{}`).
 * @returns The combined architecture report with diagnostics and
 * suppressions applied.
 */
export function analyzeProjectArchitecture(options: unknown = {}): ArchitectureReport {
  return analyzeResolvedArchitecture(resolveArchitectureOptions(options));
}
