# `agent-code-guard/no-large-public-surface`

**What it flags:** Public package entry files (typically `src/index.ts` or
the file referenced by `package.json` `main`/`exports.".."`) that export
too many symbols or re-export from too many local modules.

Defaults: more than 20 exported symbols OR more than 12 distinct local
re-export sources flags as "too wide."

**Why:** A wide public surface is hard to learn, hard to version, and
usually means the package root is publishing implementation inventory. The
larger the surface, the more breaking-change discussions you'll have, the
more your CHANGELOG entries become "tweaked something in
internal-helper-#37 you didn't know existed."

The right number depends on the package's purpose — a kitchen-sink
framework legitimately has more public symbols than a focused utility
library. The defaults are a starting point, not a law.

## Before (flagged)

```ts
// src/index.ts (28 exports flagged)
export { createDb } from "./db/client";
export { transaction } from "./db/transaction";
export { runMigrations } from "./db/migrations";
export { logger } from "./logger";
export { createLogger } from "./logger";
export { LogLevel } from "./logger";
export { createUserHandlers } from "./network/user-handlers";
export { createAuthHandlers } from "./network/auth-handlers";
// ... 20 more
```

Every consumer's IDE autocomplete shows 28 things from `your-package`.
Adding a 29th becomes a CHANGELOG decision; removing any of them becomes
a major version.

## After (preferred) — single curated facade

```ts
// src/index.ts (4 exports — clearly the contract)
export type { ServerApp, ServerConfig, ServerError } from "./app";
export { createServerApp } from "./app";
```

Consumers get one factory and three types. Internally, `app.ts`
orchestrates the 28 things you used to expose. Want to add a feature?
Add it to the orchestration, not the public surface.

## After (preferred) — split by audience via subpaths

When you genuinely have multiple consumer groups (e.g., main API + testing
helpers + advanced/extension API):

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./testing": "./dist/testing/index.js",
    "./advanced": "./dist/advanced/index.js"
  }
}
```

```ts
// src/index.ts — for most consumers (small)
export type { ServerApp } from "./app";
export { createServerApp } from "./app";

// src/testing/index.ts — for consumer test code
export { createMockServer } from "./mock-server";

// src/advanced/index.ts — for power users / plugin authors
export type { PluginContract } from "./plugin";
export { definePlugin } from "./plugin";
```

Each surface is small and audience-aware.

## Options

```js
{
  "agent-code-guard/no-large-public-surface": ["warn", {
    // Maximum number of exported symbols (named exports + default + types)
    // from the public entry. Default: 20.
    maxPublicExports: 20,

    // Maximum number of distinct local modules that the entry re-exports
    // from. 12 sources = entry is touching 12 different files for its API,
    // which usually means it's an inventory list. Default: 12.
    maxPublicReexports: 12,
  }]
}
```

## Suppressing per-file via a directive

This rule fires once per public entry file. To allow a single file's wide
surface as intentional, use a file-header directive on that entry file:

```ts
// @agent-code-guard/architecture-exception: no-large-public-surface
// reason: framework root; consumers expect a kitchen-sink import here

export type { ServerApp } from "./app";
// ... many more named re-exports ...
```

The `reason:` line is required; missing reasons surface as
`architecture-directive-parse-error` diagnostics.

For project-wide policy changes, tune the thresholds in config instead:

```js
{
  "agent-code-guard/no-large-public-surface": ["warn", {
    maxPublicExports: 50,
    maxPublicReexports: 30,
  }]
}
```

If you find yourself raising the limits, double-check whether the surface
genuinely needs to be wide or whether you're papering over an inventory
barrel. A wide-but-curated surface is fine; a
wide-because-everything-is-public surface is not.

## Rationale

Every public symbol is a promise to maintain backward compatibility. The
fewer promises, the more design freedom you keep. See
[`docs/architecture-boundary-ledger.md`](../../architecture-boundary-ledger.md)
for the full public-surface treatment.
