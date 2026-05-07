import path from "node:path";
import { checkInventoryBarrels } from "./check-inventory-barrels.js";
import { checkFolderGraph } from "./check-folder-graph.js";
import { checkPackageExports } from "./check-package-exports.js";
import { checkPublicVendorTypeLeaks } from "./check-public-type-leaks.js";
import { checkPublicSurface } from "./check-public-surface.js";
import { uniqueDiagnostics } from "./diagnostics.js";
import {
  buildDirectiveIndex,
  isDirectiveSuppressed,
  parseDirectivesFromSourceFile,
  type FileDirectives,
} from "./directives.js";
import { resolveArchitectureOptions } from "./options.js";
import { readPackageJson } from "./package-json.js";
import { buildProjectGraph } from "./project-graph.js";
import { ARCHITECTURE_DIRECTIVE_PARSE_ERROR_RULE_ID } from "./rule-ids.js";
import {
  createProgram,
  findPackageReportFile,
  projectSourceFiles,
} from "./source-program.js";
import type {
  ArchitectureDiagnostic,
  ArchitectureDiagnosticRuleId,
  ArchitectureReport,
  ResolvedArchitectureOptions,
} from "./types.js";

// Internal: assumes options have already been schema-decoded and path-resolved.
// Used by the cache layer to avoid double decoding.
export function analyzeResolvedArchitecture(
  options: ResolvedArchitectureOptions,
): ArchitectureReport {
  const packageJson = readPackageJson(options.projectRoot);
  const program = createProgram(options);
  const sourceFiles = program ? projectSourceFiles(program, options.projectRoot) : [];
  const packageReportFile = findPackageReportFile(sourceFiles, options.projectRoot);
  const graph = buildProjectGraph(sourceFiles, packageJson, options, packageReportFile);

  // Collect directives + parse errors from each source file. Successful
  // directives suppress the matching (file, ruleId) below. A directive that
  // failed to parse but named a real rule-id ALSO suppresses that rule for
  // that file — the user clearly intended to acknowledge the rule, and showing
  // them both the parse error AND the original violation is redundant noise.
  // The parse error itself surfaces under a dedicated pseudo-rule so it never
  // gets silently dropped.
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
      directiveErrorDiagnostics.push({
        ruleId: ARCHITECTURE_DIRECTIVE_PARSE_ERROR_RULE_ID,
        file: resolvedFile,
        severity: "error",
        message: `Architecture directive parse error (line ${err.line}): ${err.message}`,
      });
      if (err.ruleId !== null) {
        let set = attemptedSuppressions.get(resolvedFile);
        if (!set) {
          set = new Set();
          attemptedSuppressions.set(resolvedFile, set);
        }
        set.add(err.ruleId);
      }
    }
  }
  const directiveIndex = buildDirectiveIndex(fileDirectives);

  const allDiagnostics = uniqueDiagnostics([
    ...checkPackageExports(packageJson, options, packageReportFile),
    ...checkInventoryBarrels(sourceFiles, options),
    ...checkPublicVendorTypeLeaks(program, packageJson, options),
    ...checkPublicSurface(graph, sourceFiles, options),
    ...checkFolderGraph(graph, options),
  ]);

  const filtered = allDiagnostics.filter((d) => {
    if (d.ruleId === ARCHITECTURE_DIRECTIVE_PARSE_ERROR_RULE_ID) return true;
    const ruleId = d.ruleId as ArchitectureDiagnosticRuleId;
    const resolvedFile = path.resolve(d.file);
    if (isDirectiveSuppressed(directiveIndex, resolvedFile, ruleId)) return false;
    if (attemptedSuppressions.get(resolvedFile)?.has(ruleId)) return false;
    return true;
  });

  return {
    diagnostics: [...directiveErrorDiagnostics, ...filtered],
  };
}

// Public entry: takes raw user input, decodes via schema, resolves path
// fields, then runs analysis. Used by tests and any caller who has not
// already resolved options. The rule path uses cachedProjectArchitecture
// instead so it doesn't re-resolve.
export function analyzeProjectArchitecture(options: unknown = {}): ArchitectureReport {
  return analyzeResolvedArchitecture(resolveArchitectureOptions(options));
}
