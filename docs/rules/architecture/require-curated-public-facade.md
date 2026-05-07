# `agent-code-guard/require-curated-public-facade`

**What it flags:** Public facades (typically `src/index.ts` or the file
referenced by `package.json` `main`/`exports.".."`) that fail one of two
tests: they re-export from too many local modules
(`minPublicFacadeModules`), OR they use `export *`. Either way, the facade
isn't curating — it's mirroring filesystem inventory.

Default: a facade that re-exports from 6 or more local modules is flagged.

**Why:** A facade exists to hide volatile design decisions. If
`src/index.ts` just re-exports everything from `./db`, `./runtime`,
`./network`, `./services`, etc., it's not a facade — it's a folder
inventory with extra steps. Consumers see all the implementation choices;
refactoring any of them is a breaking change.

A real facade names a small semantic contract: ports, factories, stable
types, and registries. Everything else stays internal.

This rule warns because some packages legitimately have facades wider than
6 modules (frameworks, multi-entry-point libraries). Tune to context.

## Before (flagged)

```ts
// src/index.ts (re-exports from 4 folders × export * each → flagged)
export * from "./db";
export * from "./runtime";
export * from "./network";
export * from "./services";
```

What contract does this package offer? Whatever happens to be exported
from those four folders right now. New helpers join silently; refactors
are breaking changes.

## After (preferred) — name the small semantic contract

```ts
// src/index.ts
export type { AppConfig, AppError, AppHandle } from "./app";
export { createApp } from "./app";
```

The contract is now: "you get an `AppHandle` from `createApp(config)`,
and the errors are `AppError`." Everything else — db schemas, network
handlers, service implementations — is private.

## After (preferred) — split audiences via subpath exports

When you legitimately have multiple consumer groups:

```ts
// src/index.ts (main API — small facade)
export type { AppConfig, AppHandle } from "./app";
export { createApp } from "./app";

// src/testing/index.ts (consumer test code — separate small facade)
export { createMockApp } from "./mock";

// src/extensions/index.ts (plugin authors — separate small facade)
export type { Plugin, PluginContract } from "./plugin";
export { definePlugin } from "./plugin";
```

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./testing": "./dist/testing/index.js",
    "./extensions": "./dist/extensions/index.js"
  }
}
```

Each facade is small and curated for a specific audience.

## Options

```js
{
  "agent-code-guard/require-curated-public-facade": ["warn", {
    // Maximum local modules a facade may re-export from before the rule
    // fires. Above this is "you're listing inventory, not curating."
    // Default: 6.
    minPublicFacadeModules: 6,
  }]
}
```

## Suppressing per-file via a directive

For framework-style packages where a wide facade IS the contract, suppress
the rule for that file with a written reason:

```ts
// @agent-code-guard/architecture-exception: require-curated-public-facade
// reason: this IS the framework root; consumers expect a kitchen-sink import

export * from "./components";
export * from "./hooks";
export * from "./utils";
```

The `reason:` line is required; missing reasons surface as
`architecture-directive-parse-error` diagnostics.

Or raise `minPublicFacadeModules` repo-wide to a number that matches your
package's actual scope. The rule is meant to catch *accidental* inventory
facades, not punish deliberately wide ones.

## Rationale

Facades are the most powerful boundary tool a package has — they hide
arbitrarily complex internals behind a small named surface. Inventory
barrels squander that power. See
[`docs/architecture-boundary-ledger.md`](../../architecture-boundary-ledger.md)
for the full facade treatment.
