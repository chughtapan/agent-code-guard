# `agent-code-guard/no-console-in-effect`

**What it flags:** `console.log/error/warn/info/debug/trace` calls inside files that import from `"effect"` or any `"@effect/*"` package.

**Why:** Effect codebases route logging through `Effect.log`, `Effect.logDebug`, `Effect.logError`, or a `Logger` service so logs participate in the Effect runtime (log levels, structured annotations, span context, scoped loggers). `console.*` bypasses all of that.

## Before (flagged)

```ts
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const user = yield* loadUser();
  console.log("loaded user", user); // flagged
});
```

## After (preferred)

```ts
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const user = yield* loadUser();
  yield* Effect.log("loaded user", { user }); // structured, level-aware
});
```

For debug-level logs use `Effect.logDebug`. For errors use `Effect.logError`. For richer annotations use `Effect.annotateLogs`.

## Exceptions

CLI roots are excluded automatically. Files matching any of these patterns do **not** trigger the rule:

- under `cli/` (e.g. `src/cli/foo.ts`, `packages/x/src/cli/run.ts`)
- under `bin/` (e.g. `bin/run.ts`)
- named `cli.ts` / `cli.mts` / `cli.cts` / `cli.tsx` (at any depth)

The reason: CLI entry points often emit progress to stdout/stderr before the Effect runtime is available. Inside an Effect program in a CLI, prefer `Effect.log` and `Effect.logError`.

For one-off cases outside CLI roots:

```ts
// eslint-disable-next-line agent-code-guard/no-console-in-effect -- emergency dump before runtime starts
console.error("CRITICAL: failed to bootstrap runtime");
```
