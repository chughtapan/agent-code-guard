# `agent-code-guard/prefer-effect-platform`

**What it flags (in files importing `"effect"` or `"@effect/*"`):**

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
