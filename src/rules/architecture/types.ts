import type { ArchitectureOptions } from "./option-schemas.js";
import type { ArchitectureRuleId } from "./rule-ids.js";

export type ArchitectureSeverity = "error" | "warn";

export type {
  PackageRuntime,
  PublicTypeAllowance,
  InfrastructureAllowance,
  SubpathAllowance,
  SharedFolderAllowance,
  LayerDefinition,
  ArchitectureOptions,
  ArchitectureOptionsInput,
} from "./option-schemas.js";

export type {
  ArchitectureRuleId,
  ArchitectureDiagnosticRuleId,
} from "./rule-ids.js";

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

// projectRoot is guaranteed absolute, tsconfigPath either resolved or null.
export interface ResolvedArchitectureOptions
  extends Omit<ArchitectureOptions, "projectRoot" | "tsconfigPath"> {
  readonly projectRoot: string;
  readonly tsconfigPath: string | null;
}
