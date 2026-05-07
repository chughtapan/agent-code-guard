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
// Strictness lists (forbiddenSubpathSegments, implementationPathSegments)
// stay as bare strings because adding entries makes the rule STRICTER, not
// more permissive. There is no architectural exception to acknowledge.

export const LayerDefinition = Schema.Struct({
  name: NonEmptyString.annotations({
    description: "Layer name (entrypoint, app, domain, adapters, shared, etc.).",
  }),
  folders: Schema.Array(NonEmptyString).annotations({
    description: "Folder paths relative to the project root that belong to this layer. Longest-prefix match wins; ties resolve to the lower (earlier) layer index.",
  }),
  reason: NonEmptyString.annotations({
    description: "Why these folders form a layer. Documents the architectural intent.",
  }),
});
export type LayerDefinition = typeof LayerDefinition.Type;

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

  allowedPublicSubpaths: Schema.Array(SubpathAllowance).pipe(
    Schema.optionalWith({ default: (): ReadonlyArray<SubpathAllowance> => [] }),
  ),
  allowedTestPublicSubpaths: Schema.Array(SubpathAllowance).pipe(
    Schema.optionalWith({ default: (): ReadonlyArray<SubpathAllowance> => [] }),
  ),

  forbiddenSubpathSegments: Schema.Array(NonEmptyString).pipe(
    Schema.optionalWith({ default: (): ReadonlyArray<string> => [] }),
  ),
  implementationPathSegments: Schema.Array(NonEmptyString).pipe(
    Schema.optionalWith({ default: (): ReadonlyArray<string> => [] }),
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

  sharedFolderNames: Schema.Array(SharedFolderAllowance).pipe(
    Schema.optionalWith({ default: (): ReadonlyArray<SharedFolderAllowance> => [] }),
  ),

  publicTypePackages: Schema.Array(PublicTypeAllowance).pipe(
    Schema.optionalWith({ default: (): ReadonlyArray<PublicTypeAllowance> => [] }),
  ),

  infrastructureTypePackages: Schema.Array(InfrastructureAllowance).pipe(
    Schema.optionalWith({ default: (): ReadonlyArray<InfrastructureAllowance> => [] }),
  ),

  layers: Schema.Array(LayerDefinition).pipe(
    Schema.optionalWith({ default: (): ReadonlyArray<LayerDefinition> => [] }),
  ),

  packageRuntime: PackageRuntime.pipe(
    Schema.optionalWith({ default: () => "universal" as const }),
  ),
});

// Encoded = what users write in eslint.config.js (allowance arrays optional, etc.).
// Type    = what the analyzer reads (defaults filled in, all arrays present).
export type ArchitectureOptionsInput = typeof ArchitectureOptionsSchema.Encoded;
export type ArchitectureOptions = typeof ArchitectureOptionsSchema.Type;
