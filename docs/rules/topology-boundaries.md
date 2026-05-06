# `agent-code-guard/topology-boundaries`

Compatibility meta-rule that reports every topology diagnostic from the project
graph.

This is a project-level rule, not a prompt. It reads `tsconfig.json`, TypeScript
source files, and `package.json` metadata, then reports code shapes that make
implementation decisions public by accident.

Prefer the individual topology rules for new configs so each policy can be
tuned, suppressed, and documented independently. This rule remains useful for
early dogfooding and broad audits.

## What it catches

### Package surface

- [`no-internal-subpath-export`](no-internal-subpath-export.md): package exports such as `./internal/*`,
  `./utils`, `./src/*`, helpers, private folders, and wildcard exports.
- [`no-public-test-helper-leak`](no-public-test-helper-leak.md): public `./test-utils`, `./test-support`,
  fixtures, or test helper paths unless explicitly allowed.
- [`no-implementation-file-public-entry`](no-implementation-file-public-entry.md): public exports named after concrete
  implementation files such as adapters, handlers, services, repositories, or
  drivers.
- [`no-large-public-surface`](no-large-public-surface.md): package public entry files that export too many
  public symbols or re-export too many concrete modules.

### File and facade shape

- [`no-inventory-barrel`](no-inventory-barrel.md): `index.ts` files that export most eligible sibling
  modules. Default threshold: at least 4 exported sibling modules and at least
  60% of eligible sibling modules.
- [`no-export-star-boundary`](no-export-star-boundary.md): public or index boundary files using `export *`.
- [`require-curated-public-facade`](require-curated-public-facade.md): public facades that behave like filesystem
  inventory instead of a small semantic contract.

### Folder/package graph

- [`no-folder-cycle`](no-folder-cycle.md): strongly connected folder components.
- [`no-root-internal-cycle`](no-root-internal-cycle.md): root/public files and `internal` files importing
  through each other.
- [`no-cross-domain-sibling-import`](no-cross-domain-sibling-import.md): sibling feature folders importing each
  other directly instead of meeting through a facade, registry, or shared
  kernel.
- [`no-upward-layer-import`](no-upward-layer-import.md): lower-level files importing parent/root facades.
- [`no-package-mesh`](no-package-mesh.md): dense cyclic folder graphs that behave like one large
  module.

### Public type boundaries

- [`no-public-vendor-type-leak`](no-public-vendor-type-leak.md): public exported types mentioning dependency,
  devDependency, peerDependency, SDK, or vendor-owned types. Peer dependencies
  warn; dependency/devDependency leaks error. Node built-ins warn unless the
  package is marked Node-facing. TypeScript/lib DOM built-ins are ignored.
- [`no-public-infra-type-leak`](no-public-infra-type-leak.md): public exported types mentioning infrastructure
  libraries such as Kysely, Pino, Express, Fastify, Prisma, or MCP SDK types.
- [`require-boundary-owned-types`](require-boundary-owned-types.md): public boundary declarations that directly
  mention imported external type names instead of package-owned DTOs/ports.

```json
{
  "exports": {
    "./internal/*": "./dist/internal/*.js",
    "./utils": "./dist/utils/index.js"
  }
}
```

```ts
import type { ChatCompletion } from "openai";

export interface ChatResult {
  readonly raw: ChatCompletion;
}
```

Wrap vendor types behind domain-owned public types instead.

## Options

```ts
{
  // Defaults to the nearest package.json above the linted file.
  projectRoot: undefined,
  tsconfigPath: undefined,
  minExportedSiblingModules: 4,
  maxExportedSiblingRatio: 0.6,
  countTypeOnlyExports: true,
  allowedPublicSubpaths: [".", "./cli", "./testing"],
  allowedTestPublicSubpaths: ["./testing"],
  implementationPathSegments: ["impl", "adapter", "handler", "..."],
  maxSubpathExports: 5,
  maxWildcardExports: 0,
  maxPublicExports: 20,
  maxPublicReexports: 12,
  minPublicFacadeModules: 6,
  minPackageMeshFolders: 6,
  maxFolderEdgeDensity: 0.35,
  maxFolderCycles: 0,
  sharedFolderNames: ["shared", "common", "utils", "..."],
  infrastructureTypePackages: ["kysely", "pino", "express", "..."],
  publicTypePackages: [],
  packageRuntime: "universal"
}
```

Use `publicTypePackages` only when an external package is intentionally part of
the public contract, such as `react` for a React component library.

In monorepos, omit `projectRoot` unless one ESLint block targets exactly one
package. The rule infers the nearest package root from each linted file and
caches one project graph per package.
