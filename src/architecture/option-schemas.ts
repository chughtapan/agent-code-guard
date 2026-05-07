import { Schema } from "effect";

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

// Allowance entries: every architectural exception MUST carry a written
// reason. The act of writing the reason is the architectural decision —
// the schema enforces it at validation time so reviewers see intent in
// the config, not just a bare list.

export const PublicTypeAllowance = Schema.Struct({
  package: NonEmptyString.annotations({
    description: "External package whose types are intentionally part of this package's public contract.",
  }),
  reason: NonEmptyString.annotations({
    description: "Why this package is part of the public contract. Goes into config review and CHANGELOG context.",
  }),
});
export type PublicTypeAllowance = typeof PublicTypeAllowance.Type;

export const InfrastructureAllowance = Schema.Struct({
  package: NonEmptyString.annotations({
    description: "Infrastructure package (database client, logger, transport, etc.) whose types should be flagged in public surfaces.",
  }),
  reason: NonEmptyString.annotations({
    description: "Why this package is on the infrastructure list (not the public contract list).",
  }),
});
export type InfrastructureAllowance = typeof InfrastructureAllowance.Type;

export const SubpathAllowance = Schema.Struct({
  subpath: NonEmptyString.annotations({
    description: "package.json subpath that is intentionally part of the public contract (e.g., '.', './cli', './testing').",
  }),
  reason: NonEmptyString.annotations({
    description: "Why this subpath is public. Documents intent for future maintainers.",
  }),
});
export type SubpathAllowance = typeof SubpathAllowance.Type;

export const SharedFolderAllowance = Schema.Struct({
  folder: NonEmptyString.annotations({
    description: "Folder name treated as a shared kernel; sibling/lower-level folders may import from it without crossing a boundary.",
  }),
  reason: NonEmptyString.annotations({
    description: "Why this folder is a shared kernel rather than a domain.",
  }),
});
export type SharedFolderAllowance = typeof SharedFolderAllowance.Type;

export const PackageRuntime = Schema.Literal("browser", "node", "universal");
export type PackageRuntime = typeof PackageRuntime.Type;

const Ratio = Schema.Number.pipe(Schema.between(0, 1));
const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0));
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1));

// Defaults — these populate when the option is omitted entirely. Note that
// allowance arrays default to []; consumers MUST add explicit entries with
// reasons. There is no default allowlist.
const DEFAULT_FORBIDDEN_SUBPATHS = [
  "src", "internal", "private", "impl", "implementation",
  "utils", "helpers", "lib", "shared", "common", "adapters",
  "__generated__", "__fixtures__", "__tests__",
] as const;

const DEFAULT_IMPLEMENTATION_SEGMENTS = [
  "impl", "implementation", "adapter", "adapters",
  "handler", "handlers", "service", "services",
  "repository", "repositories", "driver", "drivers",
  "concrete",
] as const;

const DEFAULT_INFRASTRUCTURE_PACKAGES: ReadonlyArray<InfrastructureAllowance> = [
  { package: "kysely", reason: "default: SQL query builder is implementation choice" },
  { package: "pg", reason: "default: Postgres driver is implementation choice" },
  { package: "pino", reason: "default: structured logger is implementation choice" },
  { package: "winston", reason: "default: structured logger is implementation choice" },
  { package: "bunyan", reason: "default: structured logger is implementation choice" },
  { package: "drizzle-orm", reason: "default: ORM is implementation choice" },
  { package: "typeorm", reason: "default: ORM is implementation choice" },
  { package: "sequelize", reason: "default: ORM is implementation choice" },
  { package: "prisma", reason: "default: ORM is implementation choice" },
  { package: "@prisma/client", reason: "default: ORM client is implementation choice" },
  { package: "express", reason: "default: HTTP framework is implementation choice" },
  { package: "fastify", reason: "default: HTTP framework is implementation choice" },
  { package: "@modelcontextprotocol/sdk", reason: "default: MCP transport is implementation choice" },
];

// Strictness lists (forbiddenSubpathSegments, implementationPathSegments)
// stay as bare strings because adding entries makes the rule STRICTER, not
// more permissive. There is no architectural exception to acknowledge.

export const ArchitectureOptionsSchema = Schema.Struct({
  projectRoot: Schema.optional(NonEmptyString),
  tsconfigPath: Schema.optional(NonEmptyString),

  // Inventory barrel thresholds.
  minExportedSiblingModules: PositiveInt.pipe(
    Schema.optionalWith({ default: () => 4 }),
  ),
  maxExportedSiblingRatio: Ratio.pipe(
    Schema.optionalWith({ default: () => 0.6 }),
  ),
  countTypeOnlyExports: Schema.Boolean.pipe(
    Schema.optionalWith({ default: () => true }),
  ),

  // Allowance arrays: empty by default, every entry requires a reason.
  allowedPublicSubpaths: Schema.Array(SubpathAllowance).pipe(
    Schema.optionalWith({
      default: () => [
        { subpath: ".", reason: "default: primary entrypoint" },
        { subpath: "./cli", reason: "default: CLI invocation contract" },
        { subpath: "./testing", reason: "default: consumer test helpers" },
      ],
    }),
  ),
  allowedTestPublicSubpaths: Schema.Array(SubpathAllowance).pipe(
    Schema.optionalWith({
      default: () => [
        { subpath: "./testing", reason: "default: consumer test helpers" },
      ],
    }),
  ),

  // Strictness lists — bare strings are fine; adding entries makes rules stricter.
  forbiddenSubpathSegments: Schema.Array(NonEmptyString).pipe(
    Schema.optionalWith({ default: () => [...DEFAULT_FORBIDDEN_SUBPATHS] }),
  ),
  implementationPathSegments: Schema.Array(NonEmptyString).pipe(
    Schema.optionalWith({ default: () => [...DEFAULT_IMPLEMENTATION_SEGMENTS] }),
  ),

  // Public surface caps.
  maxSubpathExports: NonNegativeInt.pipe(
    Schema.optionalWith({ default: () => 5 }),
  ),
  maxWildcardExports: NonNegativeInt.pipe(
    Schema.optionalWith({ default: () => 0 }),
  ),
  maxPublicExports: PositiveInt.pipe(
    Schema.optionalWith({ default: () => 20 }),
  ),
  maxPublicReexports: NonNegativeInt.pipe(
    Schema.optionalWith({ default: () => 12 }),
  ),
  minPublicFacadeModules: PositiveInt.pipe(
    Schema.optionalWith({ default: () => 6 }),
  ),

  // Folder graph thresholds.
  minPackageMeshFolders: PositiveInt.pipe(
    Schema.optionalWith({ default: () => 6 }),
  ),
  maxFolderEdgeDensity: Ratio.pipe(
    Schema.optionalWith({ default: () => 0.35 }),
  ),
  maxFolderCycles: NonNegativeInt.pipe(
    Schema.optionalWith({ default: () => 0 }),
  ),

  // Shared folder allowance — every entry requires a reason.
  sharedFolderNames: Schema.Array(SharedFolderAllowance).pipe(
    Schema.optionalWith({
      default: () => [
        { folder: "shared", reason: "default: explicit shared kernel" },
        { folder: "common", reason: "default: explicit shared kernel" },
        { folder: "utils", reason: "default: explicit utility kernel" },
        { folder: "helpers", reason: "default: explicit utility kernel" },
        { folder: "internal", reason: "default: package-internal kernel" },
        { folder: "types", reason: "default: shared type definitions" },
        { folder: "schema", reason: "default: shared schema definitions" },
        { folder: "schemas", reason: "default: shared schema definitions" },
        { folder: "testing", reason: "default: testing helpers" },
        { folder: "test", reason: "default: testing helpers" },
        { folder: "tests", reason: "default: testing helpers" },
        { folder: "test-utils", reason: "default: testing helpers" },
        { folder: "__tests__", reason: "default: testing helpers" },
        { folder: "architecture", reason: "default: architecture analysis kernel (this package)" },
      ],
    }),
  ),

  // Vendor-type allowance — every entry requires a reason.
  publicTypePackages: Schema.Array(PublicTypeAllowance).pipe(
    Schema.optionalWith({ default: (): ReadonlyArray<PublicTypeAllowance> => [] }),
  ),

  // Infrastructure package list — every entry requires a reason.
  infrastructureTypePackages: Schema.Array(InfrastructureAllowance).pipe(
    Schema.optionalWith({
      default: (): ReadonlyArray<InfrastructureAllowance> => [...DEFAULT_INFRASTRUCTURE_PACKAGES],
    }),
  ),

  packageRuntime: PackageRuntime.pipe(
    Schema.optionalWith({ default: () => "universal" as const }),
  ),
});

// Encoded = what users write in eslint.config.js (allowance arrays optional, etc.).
// Type    = what the analyzer reads (defaults filled in, all arrays present).
export type ArchitectureOptionsInput = typeof ArchitectureOptionsSchema.Encoded;
export type ArchitectureOptions = typeof ArchitectureOptionsSchema.Type;
