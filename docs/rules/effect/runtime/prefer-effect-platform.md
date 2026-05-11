# `agent-code-guard/prefer-effect-platform`

**What it flags (in files that import the Effect runtime — see "When the rule sees a file as effectful" below):**

| Target | Triggers on | Suggested replacement |
|---|---|---|
| `fs` | imports from `fs`, `node:fs`, `fs/promises`, `node:fs/promises` | `@effect/platform` `FileSystem` |
| `http` | imports from `http`, `node:http`, `https`, `node:https` | `@effect/platform` `HttpClient` / `HttpServer` |
| `argv` | `process.argv` member access | `@effect/cli` |
| `fetch` | bare `fetch(...)` calls | `@effect/platform` `HttpClient` |
| `sql` | imports from `pg`, `pg-promise`, `mysql`, `mysql2`, `kysely`, `drizzle-orm`, `better-sqlite3` | `@effect/sql` |
| `cli` | imports from `yargs`, `commander` | `@effect/cli` |

**Why:** Effect's platform packages give you proper Effect-aware versions of these primitives — interruptible, scoped, runtime-aware, with structured errors and observability hooks. Raw Node modules and third-party clients dump promises and exceptions into your code that don't compose with the runtime.

## Before (flagged)

```ts
import { Effect } from "effect";
import * as fs from "node:fs";
import { Pool } from "pg";

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const args = process.argv.slice(2);
```

## After (preferred)

```ts
import { Effect } from "effect";
import { FileSystem } from "@effect/platform";
import { SqlClient } from "@effect/sql";
import { Cli } from "@effect/cli";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const config = JSON.parse(yield* fs.readFileString("config.json"));
  const sql = yield* SqlClient.SqlClient;
  // ...
});
```

## Options

```ts
{
  disable?: ("fs" | "http" | "argv" | "fetch" | "sql" | "cli")[];
}
```

To turn off specific targets:

```jsonc
{
  "agent-code-guard/prefer-effect-platform": [
    "error",
    { "disable": ["fetch", "sql"] }
  ]
}
```

Useful when your project hasn't migrated everything yet — disable the targets that are still in flight, leave the others on.

## When the rule sees a file as effectful

A file triggers this rule only when it actually pulls in an Effect runtime:

- Any import from `@effect/*` (`@effect/platform`, `@effect/sql`, `@effect/cli`, `@effect/rpc`, `@effect/opentelemetry`, …). These packages exist because of the Effect runtime.
- An import from `"effect"` of a runtime-bearing namespace: `Effect`, `Stream`, `Fiber`, `Layer`, `Scope`, `Runtime`, `Schedule`, `Cache`, `Pool`, `Queue`, `Hub`, `Channel`, `Deferred`, `Ref`, `SubscriptionRef`, `Synchronized`, `Metric`, `Tracer`, `Logger`.
- `import * as X from "effect"` or `import "effect"` — can't tell what's used, treated conservatively as effectful.

Files that only import **pure utilities** from `"effect"` are not flagged. Pure utilities are typed data, FP combinators, and pattern-matching helpers: `Match`, `Brand`, `Data`, `Equal`, `Hash`, `Order`, `Equivalence`, `Predicate`, `Option`, `Either`, `Cause`, `Exit`, `Chunk`, `HashMap`, `HashSet`, `List`, `Array` / `String` / `Number` / `BigInt` / `Boolean` / `Tuple` / `Record` / `Struct`, `Function`, `pipe`, `flow`, `identity`, `Duration`, `BigDecimal`, `Schema`, `ParseResult`, `JSONSchema`, the mutable / sorted collections, and `FastCheck`. None of these pull in a fiber, so a file that uses them for pure data shaping and otherwise reads from `node:fs` synchronously is fine.

A file that mixes pure and runtime imports (e.g. `import { Match, Effect } from "effect"`) is treated as effectful — one runtime import is enough.

## Pairing

- `no-promise-all-in-effect` — the runtime concurrency analogue.
- `no-console-in-effect` — the logging analogue.
- `no-process-env-at-runtime` — covers `process.env` access (not duplicated here).

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/prefer-effect-platform -- bootstrap reads config sync before Effect runtime starts
import * as fs from "node:fs";
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
```
