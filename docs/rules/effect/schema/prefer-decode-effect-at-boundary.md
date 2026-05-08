# `agent-code-guard/prefer-decode-effect-at-boundary`

**What it flags:** A call to `Schema.decodeUnknownSync` / `Schema.decodeSync` / `Schema.decodeUnknownEither` whose argument is the result of `JSON.parse(...)`, `fs.readFile(Sync)?(...)`, `await fetch(...)`, or other I/O-shaped calls. The boundary between "data from outside" and "typed program value" is exactly where the decoder should live — but the *Effect-returning* decoder, not the synchronous one.

**Why:** A synchronous decoder converts a decode failure into a thrown exception that the call site has to handle as an out-of-band error. The Effect-returning decoder (`Schema.decodeUnknown`, `Schema.decode`) returns the failure in the Effect's typed error channel, which means:

- The decoder failure can't be silently swallowed.
- The error joins the rest of your program's error union (good for retries, fallbacks, structured logging).
- The exit-on-decode-failure policy is explicit (whatever you `pipe(_, Effect.catchTag("ParseError", ...))` against), not implicit (whatever try/catch happens to wrap this call).

## Before (flagged)

```ts
import { Schema } from "@effect/schema";

const config = Schema.decodeUnknownSync(ConfigSchema)(
  JSON.parse(await fs.readFile("config.json", "utf8"))
); // throws on bad config — caller had better remember to try/catch
```

## After (preferred)

```ts
import { Effect, Schema } from "effect";

const program = Effect.gen(function* () {
  const raw = yield* Effect.tryPromise(() => fs.readFile("config.json", "utf8"));
  const parsed = yield* Effect.try(() => JSON.parse(raw));
  const config = yield* Schema.decodeUnknown(ConfigSchema)(parsed);
  // config is typed; ParseError is in the Effect's error channel
});
```

## What triggers the rule

The argument to the sync decoder must be one of:

- `JSON.parse(x)` — explicit literal source
- `fs.readFile(...)` / `fs.readFileSync(...)` / `fs.existsSync(...)` member calls
- bare `fetch(...)` calls
- `await <I/O call>` — looks through the await

If the input is a known in-memory value (`{ id: "1" }`, an already-decoded variable), the rule does not fire. Sync decoders are still useful for in-memory data where you want to fail fast with an exception (e.g., reshaping a value you already trust).

## Pairing

- `parse-into-schema-requires-effect` — flags `JSON.parse → schema` chains without `Effect.try` in between.
- `no-schema-type-cast` — flags `as Schema.Schema.Type<typeof S>` (skipping the decoder entirely).

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/prefer-decode-effect-at-boundary -- migration script: bad data should crash loudly
const config = Schema.decodeUnknownSync(ConfigSchema)(JSON.parse(input));
```
