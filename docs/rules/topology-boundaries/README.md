# Topology Boundary Diagnostics

The topology rules are separate ESLint rule names backed by one shared project
graph/cache. `agent-code-guard/topology-boundaries` remains as a compatibility
meta-rule that reports all diagnostics.

| Diagnostic | Catches |
|---|---|
| [`no-inventory-barrel`](../no-inventory-barrel.md) | `index.ts` files that export most sibling modules |
| [`no-internal-subpath-export`](../no-internal-subpath-export.md) | package exports that expose `src`, `internal`, `utils`, helpers, or wildcard paths |
| [`no-public-vendor-type-leak`](../no-public-vendor-type-leak.md) | public API types that mention dependency-owned types |
| [`no-export-star-boundary`](../no-export-star-boundary.md) | public or index boundaries using `export *` |
| [`no-folder-cycle`](../no-folder-cycle.md) | strongly connected folder dependency components |
| [`no-root-internal-cycle`](../no-root-internal-cycle.md) | root/public files and `internal` files importing through each other |
| [`no-large-public-surface`](../no-large-public-surface.md) | public entry files exporting too many symbols or local modules |
| [`no-cross-domain-sibling-import`](../no-cross-domain-sibling-import.md) | sibling feature folders importing each other directly |
| [`no-upward-layer-import`](../no-upward-layer-import.md) | lower-level files importing parent/root facades |
| [`no-public-test-helper-leak`](../no-public-test-helper-leak.md) | test helpers exposed as production package API |
| [`no-implementation-file-public-entry`](../no-implementation-file-public-entry.md) | public subpaths named after concrete implementation files |
| [`no-public-infra-type-leak`](../no-public-infra-type-leak.md) | public API types exposing DB/logger/transport/SDK implementation libraries |
| [`no-package-mesh`](../no-package-mesh.md) | dense cyclic folder graphs that behave like one module |
| [`require-curated-public-facade`](../require-curated-public-facade.md) | public facades that mirror filesystem inventory |
| [`require-boundary-owned-types`](../require-boundary-owned-types.md) | public declarations mentioning external imported type names directly |
