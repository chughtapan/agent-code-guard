# Architecture Boundary Ledger

Status: design doctrine for the `agent-code-guard` architecture analyzer. The shipped checks are the fifteen individual architecture rules under `docs/rules/architecture/` (turn them all on at once via `...guard.configs.architecture.rules`); new checks should deepen the same project graph instead of adding prompt-time coupling.

## Why this exists

The current rules catch local agent failure modes: raw throws, erased error channels, unsafe casts, runtime env reads, and related patterns. Those are necessary but not enough. Agents also create architectural debt by adding exports, imports, package dependencies, folder APIs, and public surfaces without naming the design decision each boundary is meant to hide.

The architecture analyzer turns three design principles into enforceable checks:

- **Parnas information hiding.** A boundary exists to hide a volatile design decision. If a file, folder, or package export hides no decision, it is likely accidental structure.
- **Liskov abstraction and substitutability.** Consumers should depend on stable contracts that can be substituted behind, not on concrete implementation files unless the file is explicitly a strategy.
- **Martin package dependency metrics.** Count incoming consumers, outgoing dependencies, and instability at file, folder, and package levels. Stable boundaries should not depend on unstable boundaries without an adapter.

The result is not "fewer exports" or "fewer imports." The result is that every export is a promise, every import is a dependency, and every stable boundary either exports an abstraction or justifies why the concrete detail is stable.

## Boundary levels

### File

For each source file, record:

- local files consumed;
- external packages consumed;
- runtime versus type-only consumes where detectable;
- exported values, types, schemas, config keys, and entry points;
- source consumers for each export;
- test-only consumers for each export;
- role.

File-level questions:

- Is this file a `strategy`, `adapter`, `shared-kernel`, `entrypoint`, `registry`, `facade`, `test-only`, `generated`, or `domain` file?
- Does the file export exactly the shape its role permits?
- Are named exports consumed by production code or needed to name another exported signature?
- Does the file import sibling strategies or unstable features it should not know about?
- Does a stable helper import a runtime dependency that becomes package-level coupling?

### Folder

For each folder, record:

- files inside the folder;
- folders it consumes;
- external packages it consumes;
- files it exposes to other folders;
- whether it has an explicit folder API;
- test-only deep imports;
- internal cohesion.

Folder-level questions:

- Does the folder expose a semantic API or many concrete files?
- Does dependency direction move from entrypoints to features to shared kernels, never the reverse?
- Do sibling feature files import each other?
- Is a folder acting as a pattern family, such as a set of strategies behind a registry?
- Is a shared-kernel folder cohesive enough to justify its fan-in?

### Package

For the package as a whole, record:

- `package.json` `exports`;
- root declaration surface;
- CLI commands, config keys, schemas, env vars, and generated APIs;
- production and dev dependencies;
- which files consume each runtime dependency;
- public type leaks from external packages;
- root entrypoint import fanout.

Package-level questions:

- Which public entry points are promises to external consumers?
- Does every new public symbol or subpath name intended consumers and blast radius?
- Does importing the package root load a large concrete graph?
- Are runtime dependencies justified by package-level consumers?
- Do public types expose external package types intentionally?

## Role taxonomy

Use these roles by default. Projects may rename them, but the analyzer needs equivalent semantics.

| Role | Allowed architecture | Red flags |
|---|---|---|
| `entrypoint` | High fanout assembly; exports public package surface. | Domain logic, hidden runtime dependency blast radius, undocumented public symbols. |
| `registry` | Maps stable names to strategies. | Behavioral logic, re-exporting unrelated modules, untyped registry entries. |
| `facade` | Exposes a semantic folder API. | Barrel that blindly re-exports everything. |
| `strategy` | One substitutable implementation; may consume shared kernels. | Named side exports, sibling strategy imports, public config leaks. |
| `shared-kernel` | High fan-in, low fanout, cohesive helpers/contracts. | Broad grab-bag exports, runtime deps without justification, imports from feature code. |
| `adapter` | Owns an external boundary. | External types/errors leak past the adapter without being declared public API. |
| `domain` | Owns business concepts and invariants. | Depends on transport, UI, SDK, or persistence details. |
| `test-only` | May deep-import concrete internals. | Production code imports it. |
| `generated` | May have large surface with source-of-truth metadata. | Hand-edited or used as design precedent. |

## Boundary ledger schema

The analyzer should produce a ledger equivalent to:

```ts
type BoundaryKind = "file" | "folder" | "package";

type Role =
  | "entrypoint"
  | "facade"
  | "registry"
  | "strategy"
  | "shared-kernel"
  | "adapter"
  | "domain"
  | "test-only"
  | "generated";

type BoundaryLedger = {
  kind: BoundaryKind;
  path: string;
  role: Role;
  consumes: {
    local: readonly string[];
    external: readonly string[];
    typeOnly: readonly string[];
    runtime: readonly string[];
  };
  exports: readonly {
    name: string;
    kind: "value" | "type" | "entrypoint" | "schema" | "config";
    consumers: readonly string[];
    public: boolean;
  }[];
  allowedConsumers: readonly string[];
  hiddenDecision: string;
  substitutabilityContract: string;
  externalTypeLeaks: readonly string[];
  externalRuntimeLeaks: readonly string[];
};
```

`hiddenDecision` is mandatory. A boundary that hides no decision is a smell. `substitutabilityContract` is mandatory for facades, adapters, registries, strategies, shared kernels, and package-public surfaces.

## Shipped architecture diagnostics

The current analyzer emits these diagnostics from one shared package graph:

- `no-inventory-barrel`
- `no-internal-subpath-export`
- `no-public-vendor-type-leak`
- `no-export-star-boundary`
- `no-folder-cycle`
- `no-root-internal-cycle`
- `no-large-public-surface`
- `no-cross-domain-sibling-import`
- `no-upward-layer-import`
- `no-public-test-helper-leak`
- `no-implementation-file-public-entry`
- `no-public-infra-type-leak`
- `no-package-mesh`
- `require-curated-public-facade`
- `require-boundary-owned-types`

## Next stricter checks

### `file/no-accidental-named-export`

Non-entry files may not export named declarations unless one of these is true:

- production code imports the declaration by name;
- the declaration is required to name another exported signature;
- the file role explicitly allows the export.

Tests do not justify production exports by themselves.

### `file/strategy-module-shape`

Strategy files should export one strategy value and should not import sibling strategies. Extra named exports require a declared consumer or a local-only rewrite.

### `folder/explicit-api-required`

A folder with more than a configured number of concrete files consumed from outside the folder must expose a registry or facade. The facade must be semantic. A barrel that re-exports everything is not enough.

### `folder/dependency-direction`

Stable folders cannot import unstable folders. Feature folders cannot import sibling feature folders unless the project declares a pattern that permits it.

### `folder/shared-kernel-cohesion`

Shared-kernel files or folders with high fan-in and many exports must show cohesion. Suggested first metric: compare export consumer sets and warn when a large module has low consumer overlap.

### `package/entrypoint-budget`

Every package entry point and public symbol requires intended consumers and blast radius. Adding a subpath export is a public API change.

### `package/runtime-dependency-blast`

A runtime dependency used by one internal file but loaded through a package entry point requires justification or adapter isolation.

### `package/public-type-leak`

Public package types may not expose external package types unless that dependency is explicitly part of the public API contract.

## Expected findings on this package

For `eslint-plugin-agent-code-guard` version `0.0.5`, the architecture analyzer should produce a small, high-signal report:

- Pass: `src/rules/*.ts` are mostly valid strategy modules: default rule export, consumed by root and tests, no rule-to-rule imports.
- Finding: `src/rules/no-test-skip-only.ts` exports `Modifier` and `Options` with no direct production consumers. Make them local unless a consumer is named.
- Finding: `src/rules` exposes 25 concrete rule files to `src/index.ts`. Add a semantic `src/rules/registry.ts` or `src/rules/index.ts` facade.
- Pass: `src/utils/create-rule.ts` is a small stable shared kernel with high fan-in and no local fanout.
- Warning: `src/utils/ast-refinement.ts` is a broad shared kernel. Keep it only with an export-family budget; split if helper families diverge.
- Finding: `src/utils/manual-algebra-detection.ts` is a mixed detector family. Split by detector family or by algorithm phase.
- Finding: `effect` is a runtime dependency consumed by one helper file. Justify the dependency or remove the runtime coupling.

## Floor and ceiling separation

The architecture analyzer is the floor. It does not read an architect artifact, infer an architect proposal, or verify implementation against a design doc. It reads code and local project metadata:

- TypeScript import/export syntax;
- `package.json` `exports`, `main`, `types`, and dependency fields;
- workspace package relationships;
- `tsconfig` path aliases;
- ESLint file globs;
- optional `agent-code-guard` architecture config;
- optional baselines for pre-existing debt.

The companion `agent-code-guard` Claude Code skill is the ceiling. It can teach agents to design with a Boundary Ledger, but that ledger is guidance for humans and downstream implementation skills. It is not an input contract for Guard.

Guard decides good and bad from intrinsic source facts:

- A folder that exports every local file is exporting inventory, not a boundary.
- A package entrypoint that re-exports internals makes private decisions public.
- A public type that mentions a vendor SDK leaks an adapter choice across the boundary.
- A stable helper or shared kernel that imports feature code reverses dependency direction.
- A file exported from production code but only consumed by tests is accidental public surface.
- A runtime dependency consumed by one internal file but pulled through the package root has too much blast radius.
- A strategy module with one public interface and multiple substitutable implementations is a good shape.
- A facade with narrow exports and many internal consumers is a good hiding boundary.

Exceptions are explicit floor configuration, not architecture coupling:

- mark generated files;
- mark allowed public entrypoints;
- mark known facades, strategies, adapters, and shared kernels;
- mark test-only modules;
- baseline existing violations and ratchet them down;
- suppress a rule locally only with a written reason.
