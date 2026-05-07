# `agent-code-guard/require-curated-public-facade`

**What it flags:** Public facades that expose many local modules or use
`export *`, making the facade mirror filesystem inventory.

**Why:** A facade should hide volatile design decisions. If it only repeats the
folder tree, it does not hide anything and cannot protect consumers from
internal refactors.

## Before (flagged)

```ts
export * from "./db";
export * from "./runtime";
export * from "./network";
export * from "./services";
```

## After (preferred)

```ts
export type { AppConfig, AppError, AppHandle } from "./app";
export { createApp } from "./app";
```

Public facades should name a small semantic contract: ports, factories, stable
types, and registries.

## Options

```js
{
  "agent-code-guard/require-curated-public-facade": ["warn", {
    minPublicFacadeModules: 6
  }]
}
```
