# `agent-code-guard/no-process-env-at-runtime`

**What it flags:** runtime `process.env` access in application code.

**Why:** `process.env` is an ambient global bag. Reading it deep inside app code makes configuration implicit, hard to test, and hard to validate. Read env once at the boundary, validate it there, and pass a typed config object inward. In Effect-heavy code, that usually means `Effect.Config`.

## Before (flagged)

```ts
const port = process.env.PORT ?? "3000";
const secret = process.env["ENCRYPTION_MASTER_SECRET"];
```

## After (preferred)

```ts
const config = yield* Config.all({
  port: Config.integer("PORT").pipe(Config.withDefault(3000)),
  encryptionMasterSecret: Config.string("ENCRYPTION_MASTER_SECRET"),
});
```

Scripts and bootstraps that intentionally read env can suppress the line with a reason. Default application code should not reach into `process.env` directly.
