# `safer-by-default/bare-catch`

**What it flags:** A `try`/`catch` block that either omits the caught error (`} catch {`) or binds it to an underscore-prefixed name (`catch (_)`, `catch (_err)`).

**Why:** A silent catch turns a debuggable failure into a mystery. At minimum, bind the error and log it. If the surrounding code is on Effect, you almost certainly shouldn't be writing `try`/`catch` at all — use `Effect.try` / `Effect.tryPromise` with an explicit `catch` that builds a typed error.

## Before (flagged)

```ts
try {
  maybeRiskyThing();
} catch {
  // silent
}
```

```ts
try {
  maybeRiskyThing();
} catch (_err) {
  // swallow
}
```

## After (preferred) — non-Effect code

```ts
try {
  maybeRiskyThing();
} catch (err) {
  logger.error({ err }, "maybeRiskyThing failed");
  throw err; // or handle explicitly
}
```

## After (preferred) — Effect-first code

```ts
import { Effect } from "effect";

class RiskyError extends Data.TaggedError("RiskyError")<{ cause: unknown }> {}

const risky = Effect.try({
  try: () => maybeRiskyThing(),
  catch: (cause) => new RiskyError({ cause }),
});
```

Notes for agents:
- If a safe mechanical fix is acceptable, bind the error to `err`, log it, and rethrow. The rule exposes an ESLint suggestion that does exactly this.
- If the surrounding code is on Effect, the right rewrite is `Effect.try` / `Effect.tryPromise` with a tagged error class.

## Exceptions

You genuinely need the "absorb and continue" behavior (e.g. a best-effort cleanup in a `finally`-like context):

```ts
try {
  await cleanup();
} catch (err) {
  // eslint-disable-next-line safer-by-default/bare-catch -- best-effort cleanup; log but do not propagate
  logger.warn({ err }, "cleanup failed (non-fatal)");
}
```

Note: even in this case, you should still bind and log — the rule also catches `catch (_)` specifically to prevent "bind but ignore."
