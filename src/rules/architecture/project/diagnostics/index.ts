import type { ArchitectureRuleId } from "../../rule-ids.js";

export type ArchitectureSeverity = "error" | "warn";

export type {
  LayerDefinition,
  ArchitectureOptions,
} from "../config-schema.js";

export type { ArchitectureDiagnosticRuleId } from "../../rule-ids.js";
export type { ResolvedArchitectureOptions } from "../config.js";

export interface ArchitectureDiagnostic {
  readonly ruleId: ArchitectureRuleId;
  readonly file: string;
  readonly severity: ArchitectureSeverity;
  readonly message: string;
}

export interface ArchitectureReport {
  readonly diagnostics: readonly ArchitectureDiagnostic[];
}

export interface PackageJson {
  readonly name?: string;
  readonly main?: string;
  readonly types?: string;
  readonly exports?: unknown;
  readonly dependencies: ReadonlyMap<string, string>;
  readonly devDependencies: ReadonlyMap<string, string>;
  readonly peerDependencies: ReadonlyMap<string, string>;
}

export interface PackageExportEntry {
  readonly publicPath: string;
  readonly targetPath: string;
}

export function uniqueDiagnostics(
  diagnostics: readonly ArchitectureDiagnostic[],
): readonly ArchitectureDiagnostic[] {
  const seen = new Set<string>();
  const unique: ArchitectureDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.ruleId}\0${diagnostic.file}\0${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(diagnostic);
  }

  return unique;
}
