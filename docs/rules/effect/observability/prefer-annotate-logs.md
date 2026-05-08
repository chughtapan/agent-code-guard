# `agent-code-guard/prefer-annotate-logs`

**What it flags:** `Effect.log` / `logDebug` / `logInfo` / `logWarning` / `logError` / `logFatal` / `logTrace` calls whose second argument is an inline object literal.

**Why:** Repeating the same context object at every log call is verbose, error-prone, and easy to drift between adjacent log lines. `Effect.annotateLogs` attaches a context once on the surrounding Effect; every log inside that scope inherits the annotations. Same data ends up in your log backend, but the source code is shorter and the context can't accidentally diverge between sibling logs.

## Before (flagged)

```ts
Effect.gen(function* () {
  yield* Effect.log("loaded user", { userId: id, requestId });
  yield* Effect.log("validated user", { userId: id, requestId });
  yield* Effect.log("saved user", { userId: id, requestId });
});
```

## After (preferred)

```ts
Effect.gen(function* () {
  yield* Effect.log("loaded user");
  yield* Effect.log("validated user");
  yield* Effect.log("saved user");
}).pipe(Effect.annotateLogs({ userId: id, requestId }));
```

Or, if the annotations differ per-step, use `Effect.annotateCurrentSpan` for span-scoped annotations and keep `Effect.log` single-arg.

## What's exempt

The rule fires only when the second argument is an **object literal**. If the second argument is an identifier (`ctx`), a function call (`buildContext()`), or any other expression, the rule does not fire — the assumption is that you've factored the context construction somewhere else and the call site is already concise.

## Pairing

- `no-console-in-effect` — keeps logging on the Effect Logger to begin with.
- `logger-config-at-boot` — keeps Logger configuration at the entry point.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/prefer-annotate-logs -- one-off context not worth a wrapping annotateLogs frame
yield* Effect.log("startup complete", { startMs: Date.now() - origin });
```
