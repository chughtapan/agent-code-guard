# `agent-code-guard/no-env-nonnull-assert`

**What it flags:** Non-null assertions on `process.env.X` reads, e.g. `process.env.PORT!`.

**Why:** A non-null assertion silences TypeScript without validating the value at runtime. If `PORT` is unset or empty, the bang doesn't change reality — it just prevents a compile-time error so the bug surfaces somewhere else (a `parseInt(undefined!)` returning `NaN`, a fetch to `https://undefined/...`, a SQL connection that pretends to succeed). Validate or default the read at the boundary instead.

## Before (flagged)

```ts
const port = process.env.PORT!;
const dbUrl = process.env.DATABASE_URL!;
```

## After (preferred)

Default with `??`:

```ts
const port = process.env.PORT ?? "8080";
```

Validate at boundary with Effect Config:

```ts
import { Config, Effect } from "effect";

const config = Config.all({
  port: Config.number("PORT").pipe(Config.withDefault(8080)),
  dbUrl: Config.redacted("DATABASE_URL"),
});

const program = Effect.gen(function* () {
  const { port, dbUrl } = yield* config;
  // ...
});
```

Validate at boundary without Effect:

```ts
function readEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}
const port = readEnv("PORT");
```

## Companion rules

This rule pairs with `agent-code-guard/no-process-env-at-runtime`, which flags `process.env.X` reads inside application code (away from the boot boundary). Together they push config reads to the edge and then through a typed validator.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/no-env-nonnull-assert -- bin entrypoint, validated by readyz check
const port = process.env.PORT!;
```
