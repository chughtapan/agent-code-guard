# `agent-code-guard/no-large-public-surface`

**What it flags:** Public package entry files with too many exported symbols or
too many local reexports.

Defaults: `maxPublicExports: 20`, `maxPublicReexports: 12`.

**Why:** A large public surface is hard to reason about, hard to version, and
usually means the package root is exporting implementation inventory instead of
a stable contract.

## Before (flagged)

```ts
export { createDb } from "./db/client";
export { transaction } from "./db/transaction";
export { logger } from "./logger";
export { createUserHandlers } from "./network/user-handlers";
export { UserService } from "./services/user-service";
```

## After (preferred)

```ts
export type { ServerApp, ServerConfig } from "./app";
export { createServerApp } from "./app";
```

Split infrastructure/testing/advanced surfaces behind explicit subpaths only
when they are true public contracts.

## Options

```js
{
  "agent-code-guard/no-large-public-surface": ["warn", {
    maxPublicExports: 20,
    maxPublicReexports: 12
  }]
}
```
