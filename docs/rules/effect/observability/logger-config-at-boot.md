# `agent-code-guard/logger-config-at-boot`

**What it flags:** A call to `Logger.withMinimumLogLevel`, `Logger.withConsoleLog`, or `Logger.withConsoleError` outside a boot file (one of: `index.ts`, `main.ts`, `cli.ts`, files under `bin/` or `cli/`, files named `bootstrap.ts` or `server.ts`, or `*.config.*` files).

**Why:** Logger configuration is a process-wide concern. Configuring it inside a feature module:

- Reconfigures the logger every time that module is imported in a different runtime context (tests, scripts, partial builds).
- Hides the global log policy in a place no one will think to look.
- Makes it harder to honor environment-specific levels (dev / staging / prod) since the config is split across the codebase.

The right shape is to configure once at the entry point, then *use* `Logger.log*` and `Effect.log*` everywhere else.

## Before (flagged)

`src/feature/work.ts`:

```ts
import { Effect, Logger, LogLevel } from "effect";

export const work = Effect.gen(function* () {
  yield* Effect.log("starting");
  // ...
}).pipe(Logger.withMinimumLogLevel(LogLevel.Debug)); // flagged: business code
```

## After (preferred)

`src/index.ts`:

```ts
import { Effect, Logger, LogLevel } from "effect";
import { work } from "./feature/work.js";

const program = work.pipe(
  Logger.withMinimumLogLevel(
    process.env.NODE_ENV === "production" ? LogLevel.Info : LogLevel.Debug
  ),
);

Effect.runPromise(program);
```

`src/feature/work.ts`:

```ts
export const work = Effect.gen(function* () {
  yield* Effect.log("starting");
  // ... no Logger config here
});
```

## Boot file patterns

Files that bypass the rule:

- `**/index.ts`, `**/main.ts`, `**/cli.ts`
- Anything under `bin/` or `cli/`
- `**/bootstrap.{ts,...}`, `**/server.{ts,...}`
- `**/*.config.{ts,...}`

If your boot lives somewhere else, scope the rule via flat-config `files` glob to skip it, or rename the file.

## Pairing

- `no-console-in-effect` — keep all logging on the Effect Logger inside Effect files.
- `prefer-annotate-logs` — once Logger is in use, prefer `Effect.annotateLogs` over inline context objects.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/logger-config-at-boot -- per-test-suite verbosity, not a global config
const verbose = pipe(suite, Logger.withMinimumLogLevel(LogLevel.Debug));
```
