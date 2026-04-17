# `safer-by-default/record-cast`

**What it flags:** `as Record<string, unknown>` casts.

**Why:** This idiom almost always papers over a missing schema or validation step. It tells the type system "trust me, this is an object" without any runtime check, which is exactly the kind of cast that bites during refactors. Decode into a typed result instead — Effect `Schema`, Zod, or your own parser.

## Before (flagged)

```ts
const body = (await req.json()) as Record<string, unknown>;
const name = body.name as string;
```

## After (preferred) — Effect Schema

```ts
import { Schema } from "effect";

const RequestBody = Schema.Struct({
  name: Schema.String,
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
});

const body = yield* Schema.decodeUnknown(RequestBody)(await req.json());
// body is now typed as { name: string; email: string }
```

## After (preferred) — Zod

```ts
import { z } from "zod";

const RequestBody = z.object({
  name: z.string(),
  email: z.string().email(),
});

const body = RequestBody.parse(await req.json());
```

Notes for agents:
- If the source is a DB row, use the generated types from your query builder (e.g. Kysely's `Selectable<T>`).
- If the source is an HTTP payload or external JSON, use a schema library — don't hand-cast.
- If you truly need "any object," prefer `as unknown` and then narrow with an explicit type guard; `Record<string, unknown>` is the worst of both worlds (looks safe, isn't).

## Exceptions

Interacting with an API whose shape is genuinely dynamic (e.g. writing a logger that accepts arbitrary context):

```ts
// eslint-disable-next-line safer-by-default/record-cast -- logger context is intentionally open-shape
export function log(event: string, ctx: unknown) {
  transport.emit({ event, ctx: ctx as Record<string, unknown> });
}
```
