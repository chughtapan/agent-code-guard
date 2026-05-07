export type ArchitectureSeverity = "error" | "warn";

export type PackageRuntime = "browser" | "node" | "universal";

export interface ArchitectureOptions {
  readonly projectRoot?: string;
  readonly tsconfigPath?: string;
  readonly minExportedSiblingModules?: number;
  readonly maxExportedSiblingRatio?: number;
  readonly countTypeOnlyExports?: boolean;
  readonly allowedPublicSubpaths?: readonly string[];
  readonly allowedTestPublicSubpaths?: readonly string[];
  readonly forbiddenSubpathSegments?: readonly string[];
  readonly implementationPathSegments?: readonly string[];
  readonly maxSubpathExports?: number;
  readonly maxWildcardExports?: number;
  readonly maxPublicExports?: number;
  readonly maxPublicReexports?: number;
  readonly minPublicFacadeModules?: number;
  readonly minPackageMeshFolders?: number;
  readonly maxFolderEdgeDensity?: number;
  readonly maxFolderCycles?: number;
  readonly sharedFolderNames?: readonly string[];
  readonly infrastructureTypePackages?: readonly string[];
  readonly publicTypePackages?: readonly string[];
  readonly packageRuntime?: PackageRuntime;
}

export interface NormalizedArchitectureOptions {
  readonly projectRoot: string;
  readonly tsconfigPath: string | null;
  readonly minExportedSiblingModules: number;
  readonly maxExportedSiblingRatio: number;
  readonly countTypeOnlyExports: boolean;
  readonly allowedPublicSubpaths: readonly string[];
  readonly allowedTestPublicSubpaths: readonly string[];
  readonly forbiddenSubpathSegments: readonly string[];
  readonly implementationPathSegments: readonly string[];
  readonly maxSubpathExports: number;
  readonly maxWildcardExports: number;
  readonly maxPublicExports: number;
  readonly maxPublicReexports: number;
  readonly minPublicFacadeModules: number;
  readonly minPackageMeshFolders: number;
  readonly maxFolderEdgeDensity: number;
  readonly maxFolderCycles: number;
  readonly sharedFolderNames: readonly string[];
  readonly infrastructureTypePackages: readonly string[];
  readonly publicTypePackages: readonly string[];
  readonly packageRuntime: PackageRuntime;
}

export interface ArchitectureDiagnostic {
  readonly ruleId:
    | "no-inventory-barrel"
    | "no-internal-subpath-export"
    | "no-public-vendor-type-leak"
    | "no-export-star-boundary"
    | "no-folder-cycle"
    | "no-root-internal-cycle"
    | "no-large-public-surface"
    | "no-cross-domain-sibling-import"
    | "no-upward-layer-import"
    | "no-public-test-helper-leak"
    | "no-implementation-file-public-entry"
    | "no-public-infra-type-leak"
    | "no-package-mesh"
    | "require-curated-public-facade"
    | "require-boundary-owned-types";
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

export const DEFAULT_TOPOLOGY_OPTIONS = {
  minExportedSiblingModules: 4,
  maxExportedSiblingRatio: 0.6,
  countTypeOnlyExports: true,
  allowedPublicSubpaths: [".", "./cli", "./testing"],
  allowedTestPublicSubpaths: ["./testing"],
  forbiddenSubpathSegments: [
    "src",
    "internal",
    "private",
    "impl",
    "implementation",
    "utils",
    "helpers",
    "lib",
    "shared",
    "common",
    "adapters",
    "__generated__",
    "__fixtures__",
    "__tests__",
  ],
  implementationPathSegments: [
    "impl",
    "implementation",
    "adapter",
    "adapters",
    "handler",
    "handlers",
    "service",
    "services",
    "repository",
    "repositories",
    "driver",
    "drivers",
    "concrete",
  ],
  maxSubpathExports: 5,
  maxWildcardExports: 0,
  maxPublicExports: 20,
  maxPublicReexports: 12,
  minPublicFacadeModules: 6,
  minPackageMeshFolders: 6,
  maxFolderEdgeDensity: 0.35,
  maxFolderCycles: 0,
  sharedFolderNames: [
    "shared",
    "common",
    "utils",
    "helpers",
    "internal",
    "types",
    "architecture",
    "schema",
    "schemas",
    "testing",
    "test",
    "tests",
    "test-utils",
    "__tests__",
  ],
  infrastructureTypePackages: [
    "kysely",
    "pg",
    "pino",
    "winston",
    "bunyan",
    "drizzle-orm",
    "typeorm",
    "sequelize",
    "prisma",
    "@prisma/client",
    "express",
    "fastify",
    "@modelcontextprotocol/sdk",
  ],
  publicTypePackages: [],
  packageRuntime: "universal",
} as const;
