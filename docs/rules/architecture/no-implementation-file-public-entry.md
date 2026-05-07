# `agent-code-guard/no-implementation-file-public-entry`

**What it flags:** `package.json` exports whose subpath name (or whose
target file path) contains implementation-pattern segments such as
`adapter`, `handler`, `service`, `repository`, `driver`, `concrete`,
`impl`, `implementation`. Example flagged subpaths: `./db/driver`,
`./handlers`, `./services/user`, `./adapters/http`.

**Why:** Public subpaths should name *what consumers depend on*, not *the
design pattern currently used behind the boundary*. Naming a public entry
`./db/driver` tells consumers there's a "driver" concept and hints at how
the package is built; if you later swap the driver pattern for a strategy
or a handler, the public name becomes misleading.

Consumer-facing names should describe contract intent: `./storage`,
`./server`, `./logger` — not implementation pattern: `./db/driver`,
`./network/handler`, `./logger/adapter`.

## Before (flagged)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./db/driver": "./dist/db/driver.js",
    "./handlers": "./dist/network/handlers.js",
    "./services/user": "./dist/services/user-service.js"
  }
}
```

`./db/driver` exposes both the concept of a driver AND the file location.
Refactoring `db/driver.ts` into `db/strategy/postgres.ts` becomes a breaking
change.

## After (preferred) — name by contract, not pattern

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./storage": "./dist/storage/index.js",
    "./server": "./dist/server/index.js",
    "./users": "./dist/users/index.js"
  }
}
```

`./storage` is what consumers depend on (storage capability). Whether it's
implemented as a driver, a strategy, or a service is now your private
concern.

## After (preferred) — single root export

For most libraries, you don't need separate subpaths at all. One root
export with curated re-exports is simpler and harder to misuse:

```json
{
  "exports": {
    ".": "./dist/index.js"
  }
}
```

```ts
// src/index.ts
export { createStorage } from "./storage";
export type { Storage, StorageError } from "./storage";
```

## How to configure

The plugin ships no default for `implementationPathSegments`. Without
configuration the rule is dormant. Recommended starter values:

```js
{
  "agent-code-guard/no-implementation-file-public-entry": ["error", {
    implementationPathSegments: [
      "adapter", "adapters",
      "handler", "handlers",
      "service", "services",
      "repository", "repositories",
      "driver", "drivers",
      "impl", "implementation",
      "concrete",
    ],
  }]
}
```

Pick the segments that actually appear in your codebase as
implementation-pattern names — adding an entry makes the rule stricter,
not more permissive, so there's no harm in extending the list.

## Suppressing exceptions

`package.json` doesn't accept comments, and this rule fires on the manifest
rather than a source file, so file-header directives don't apply. If you
genuinely need to expose an implementation-shaped subpath (rare — usually a
sign that the public contract is leaking), the right path is to rename the
subpath to something contract-shaped and re-export from there. Don't shrink
`implementationPathSegments` as a workaround.

## Rationale

A public name is a promise. Naming the promise after a current
implementation pattern locks the package into that pattern forever, or
forces a breaking change to escape. See
[`docs/architecture-boundary-ledger.md`](../../architecture-boundary-ledger.md)
for the full naming-by-contract treatment.
