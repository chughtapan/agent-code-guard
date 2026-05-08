import fs from "node:fs";
import path from "node:path";
import type { TSESLint } from "@typescript-eslint/utils";
import type { JSONSchema4 } from "@typescript-eslint/utils/json-schema";
import {
  ArchitectureOptionsError,
  architectureOptionsJsonSchema,
  cachedProjectArchitecture,
  resolveArchitectureOptions,
  type ArchitectureDiagnostic,
  type ArchitectureReport,
  type ArchitectureOptionsInput,
} from "./project/api/index.js";
import {
  ARCHITECTURE_DIAGNOSTIC_RULE_IDS,
  type ArchitectureRuleId,
} from "./rule-ids.js";
import { createRule } from "../../utils/create-rule.js";

type RuleEntry = TSESLint.Linter.RuleEntry;
type Options = [ArchitectureOptionsInput?];
type MessageIds = "architectureViolation";
type RuleContext = TSESLint.RuleContext<MessageIds, Options>;

// Generate the ESLint JSONSchema from the Effect schema once at module load.
// Single source of truth for option shape: changes flow through the schema
// definition and ESLint picks them up automatically.
const optionsJsonSchema = architectureOptionsJsonSchema() as JSONSchema4;
const schema: readonly JSONSchema4[] = [optionsJsonSchema];

function createArchitectureDiagnosticRule(
  name: string,
  diagnosticRuleIds: readonly ArchitectureRuleId[],
  description: string,
) {
  const allowedRuleIds = new Set<ArchitectureRuleId>(diagnosticRuleIds);

  return createRule<Options, MessageIds>({
    name,
    meta: {
      type: "problem",
      docs: { description },
      messages: {
        architectureViolation: "{{message}}",
      },
      schema,
      fixable: undefined,
      hasSuggestions: false,
    },
    defaultOptions: [{}],
    create(context, [rawOptions = {}]) {
      const cwd = context.cwd ?? process.cwd();
      const filename = resolveLintedFilename(context.filename, rawOptions, cwd);
      const projectRoot = rawOptions.projectRoot ?? findNearestPackageRoot(filename) ?? cwd;

      try {
        const options = resolveArchitectureOptions(rawOptions, projectRoot);
        return architectureReportListener(
          context,
          cachedProjectArchitecture(options),
          allowedRuleIds,
          filename,
        );
      } catch (error) {
        if (error instanceof ArchitectureOptionsError) {
          return architectureConfigErrorListener(context, error.message);
        }
        throw error;
      }
    },
  });
}

function resolveLintedFilename(
  filename: string,
  rawOptions: ArchitectureOptionsInput,
  cwd: string,
): string {
  return path.isAbsolute(filename)
    ? path.resolve(filename)
    : path.resolve(rawOptions.projectRoot ?? cwd, filename);
}

function architectureConfigErrorListener(
  context: RuleContext,
  message: string,
): TSESLint.RuleListener {
  return {
    Program(node) {
      context.report({
        node,
        messageId: "architectureViolation",
        data: { message },
      });
    },
  };
}

function architectureReportListener(
  context: RuleContext,
  report: ArchitectureReport,
  allowedRuleIds: ReadonlySet<ArchitectureRuleId>,
  filename: string,
): TSESLint.RuleListener {
  return {
    Program(node) {
      for (const diagnostic of report.diagnostics) {
        if (shouldReportDiagnostic(diagnostic, allowedRuleIds, filename)) {
          context.report({
            node,
            messageId: "architectureViolation",
            data: { message: diagnostic.message },
          });
        }
      }
    },
  };
}

function shouldReportDiagnostic(
  diagnostic: ArchitectureDiagnostic,
  allowedRuleIds: ReadonlySet<ArchitectureRuleId>,
  filename: string,
): boolean {
  return allowedRuleIds.has(diagnostic.ruleId) &&
    path.resolve(diagnostic.file) === filename;
}

export {
  ARCHITECTURE_DIAGNOSTIC_RULE_IDS as architectureDiagnosticRuleIds,
};

const packageRootCache = new Map<string, string | null>();

function findNearestPackageRoot(fileName: string): string | null {
  const cached = packageRootCache.get(fileName);
  if (cached !== undefined) return cached;
  const result = walkUpForPackageRoot(path.dirname(fileName));
  packageRootCache.set(fileName, result);
  return result;
}

function walkUpForPackageRoot(directory: string): string | null {
  if (fs.existsSync(path.join(directory, "package.json"))) return directory;
  const parent = path.dirname(directory);
  return parent === directory ? null : walkUpForPackageRoot(parent);
}

export const architectureRules = {
  "no-inventory-barrel": createArchitectureDiagnosticRule(
    "no-inventory-barrel",
    ["no-inventory-barrel"],
    "Flag index files that export most sibling modules instead of a curated abstraction.",
  ),
  "no-internal-subpath-export": createArchitectureDiagnosticRule(
    "no-internal-subpath-export",
    ["no-internal-subpath-export"],
    "Flag package exports that expose internal, source, utility, helper, or wildcard paths.",
  ),
  "no-public-vendor-type-leak": createArchitectureDiagnosticRule(
    "no-public-vendor-type-leak",
    ["no-public-vendor-type-leak"],
    "Flag public API types that mention dependency-owned vendor types.",
  ),
  "no-export-star-boundary": createArchitectureDiagnosticRule(
    "no-export-star-boundary",
    ["no-export-star-boundary"],
    "Flag public or index boundaries that use export-star declarations.",
  ),
  "no-folder-cycle": createArchitectureDiagnosticRule(
    "no-folder-cycle",
    ["no-folder-cycle"],
    "Flag strongly connected folder dependency components.",
  ),
  "no-root-internal-cycle": createArchitectureDiagnosticRule(
    "no-root-internal-cycle",
    ["no-root-internal-cycle"],
    "Flag root/public files and internal files that depend on each other.",
  ),
  "no-large-public-surface": createArchitectureDiagnosticRule(
    "no-large-public-surface",
    ["no-large-public-surface"],
    "Flag public entry files with too many exported symbols or local reexports.",
  ),
  "no-cross-domain-sibling-import": createArchitectureDiagnosticRule(
    "no-cross-domain-sibling-import",
    ["no-cross-domain-sibling-import"],
    "Flag direct imports between sibling feature folders.",
  ),
  "no-upward-layer-import": createArchitectureDiagnosticRule(
    "no-upward-layer-import",
    ["no-upward-layer-import"],
    "Flag lower-level files importing parent or root facades.",
  ),
  "no-public-test-helper-leak": createArchitectureDiagnosticRule(
    "no-public-test-helper-leak",
    ["no-public-test-helper-leak"],
    "Flag test helper surfaces exposed as public package API.",
  ),
  "no-implementation-file-public-entry": createArchitectureDiagnosticRule(
    "no-implementation-file-public-entry",
    ["no-implementation-file-public-entry"],
    "Flag public package subpaths named after concrete implementation files.",
  ),
  "no-public-infra-type-leak": createArchitectureDiagnosticRule(
    "no-public-infra-type-leak",
    ["no-public-infra-type-leak"],
    "Flag public API types that expose infrastructure libraries.",
  ),
  "no-package-mesh": createArchitectureDiagnosticRule(
    "no-package-mesh",
    ["no-package-mesh"],
    "Flag dense cyclic package folder graphs.",
  ),
  "no-large-folder": createArchitectureDiagnosticRule(
    "no-large-folder",
    ["no-large-folder"],
    "Flag folders with too many direct semantic children or unpaired test children.",
  ),
  "folder-readme-required": createArchitectureDiagnosticRule(
    "folder-readme-required",
    ["folder-readme-required"],
    "Require larger folders to document their boundary with a README.",
  ),
  "no-distant-folder-import": createArchitectureDiagnosticRule(
    "no-distant-folder-import",
    ["no-distant-folder-import"],
    "Flag local imports that reach across too many folder hops.",
  ),
  "require-curated-public-facade": createArchitectureDiagnosticRule(
    "require-curated-public-facade",
    ["require-curated-public-facade"],
    "Require public facades to curate semantic contracts instead of filesystem inventory.",
  ),
  "require-boundary-owned-types": createArchitectureDiagnosticRule(
    "require-boundary-owned-types",
    ["require-boundary-owned-types"],
    "Require public boundary types to use package-owned names instead of imported vendor names.",
  ),
  "folder-explicit-api-required": createArchitectureDiagnosticRule(
    "folder-explicit-api-required",
    ["folder-explicit-api-required"],
    "Flag folders consumed through multiple concrete implementation files instead of a semantic facade.",
  ),
  "file-implicit-boundary-module": createArchitectureDiagnosticRule(
    "file-implicit-boundary-module",
    ["file-implicit-boundary-module"],
    "Flag non-facade files that act as implicit boundaries between caller and implementation regions.",
  ),
  "shared-kernel-cohesion": createArchitectureDiagnosticRule(
    "shared-kernel-cohesion",
    ["shared-kernel-cohesion"],
    "Flag shared kernels whose exported symbols are consumed by mostly disjoint modules.",
  ),
  "architecture-directive-parse-error": createArchitectureDiagnosticRule(
    "architecture-directive-parse-error",
    ["architecture-directive-parse-error"],
    "Surface malformed @agent-code-guard/architecture-exception directives so they cannot silently fail to suppress.",
  ),
} as const;

export const recommendedArchitectureRuleEntries: Record<string, RuleEntry> = {
  "agent-code-guard/no-folder-cycle": "error",
  "agent-code-guard/no-root-internal-cycle": "error",
  "agent-code-guard/no-internal-subpath-export": "error",
  "agent-code-guard/no-public-test-helper-leak": "error",
  "agent-code-guard/no-export-star-boundary": "error",
  "agent-code-guard/no-implementation-file-public-entry": "error",
  "agent-code-guard/no-public-vendor-type-leak": "error",
  "agent-code-guard/no-public-infra-type-leak": "warn",
  "agent-code-guard/no-inventory-barrel": "warn",
  "agent-code-guard/no-large-public-surface": "warn",
  "agent-code-guard/no-upward-layer-import": "warn",
  "agent-code-guard/no-cross-domain-sibling-import": "warn",
  "agent-code-guard/no-package-mesh": "warn",
  "agent-code-guard/no-large-folder": "warn",
  "agent-code-guard/folder-readme-required": "warn",
  "agent-code-guard/no-distant-folder-import": "warn",
  "agent-code-guard/require-curated-public-facade": "warn",
  "agent-code-guard/require-boundary-owned-types": "warn",
  "agent-code-guard/folder-explicit-api-required": "warn",
  "agent-code-guard/file-implicit-boundary-module": "warn",
  "agent-code-guard/shared-kernel-cohesion": "warn",
  "agent-code-guard/architecture-directive-parse-error": "error",
};

export const architecturePresetRuleEntries: Record<string, RuleEntry> = {
  "agent-code-guard/no-inventory-barrel": "warn",
  "agent-code-guard/no-internal-subpath-export": "warn",
  "agent-code-guard/no-public-vendor-type-leak": "warn",
  "agent-code-guard/no-export-star-boundary": "warn",
  "agent-code-guard/no-folder-cycle": "warn",
  "agent-code-guard/no-root-internal-cycle": "warn",
  "agent-code-guard/no-large-public-surface": "warn",
  "agent-code-guard/no-cross-domain-sibling-import": "warn",
  "agent-code-guard/no-upward-layer-import": "warn",
  "agent-code-guard/no-public-test-helper-leak": "warn",
  "agent-code-guard/no-implementation-file-public-entry": "warn",
  "agent-code-guard/no-public-infra-type-leak": "warn",
  "agent-code-guard/no-package-mesh": "warn",
  "agent-code-guard/no-large-folder": "warn",
  "agent-code-guard/folder-readme-required": "warn",
  "agent-code-guard/no-distant-folder-import": "warn",
  "agent-code-guard/require-curated-public-facade": "warn",
  "agent-code-guard/require-boundary-owned-types": "warn",
  "agent-code-guard/folder-explicit-api-required": "warn",
  "agent-code-guard/file-implicit-boundary-module": "warn",
  "agent-code-guard/shared-kernel-cohesion": "warn",
  "agent-code-guard/architecture-directive-parse-error": "error",
};
