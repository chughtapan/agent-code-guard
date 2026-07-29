# `agent-code-guard/require-span-on-exported-effect`

> **Severity: `error`** — exported Effect entrypoints are mandatory trace
> boundaries in both main presets.

**What it flags:** An exported `Effect.gen(...)` value (or an exported function returning `Effect.gen(...)`) whose definition does not call `Effect.withSpan` anywhere. The rule looks for the literal `withSpan` reference inside the export's subtree.

**Why:** Spans are how you find your program in production. An exported Effect surface that has no span is invisible — when something downstream is slow or failing, the trace stops at the caller and starts again somewhere later. Naming the span at the export boundary gives every consumer a consistent label to filter against.

## Before (flagged)

```ts
import { Effect } from "effect";

export const loadUser = Effect.gen(function* () {
  const id = yield* readId;
  return yield* fetchUser(id);
});
```

## After (preferred)

Inline:

```ts
export const loadUser = Effect.gen(function* () {
  const id = yield* readId;
  return yield* fetchUser(id);
}).pipe(Effect.withSpan("loadUser"));
```

Or wrap an inner step:

```ts
export const loadUser = Effect.gen(function* () {
  const id = yield* readId;
  return yield* Effect.withSpan("loadUser.fetch")(fetchUser(id));
});
```

## What counts as "has a span"

Any reference to `withSpan` in the subtree of the exported declaration — whether it's `Effect.withSpan(...)`, `pipe(_, Effect.withSpan(...))`, or imported and called as `withSpan(...)`. The rule is a structural check, not a semantic one: if the identifier appears, the rule trusts you.

## What's exempt

- Non-exported Effects (private to the module).
- Exported values that aren't Effect.gen-shaped (constants, types, plain functions).
- Test fixtures and helpers (the `no-example-only-tests` and test-file-glob exclusions still apply if you scope the rule via flat config).

## Pairing

- `handler-requires-span` — flags handler-shaped Effect bodies (route/message handlers) without `withSpan`.
- `annotate-without-span` — flags `Effect.annotateCurrentSpan` outside an enclosing `withSpan` frame.

## Adoption tip

Run a tracing-adoption pass before enabling the main preset in an existing
Effect codebase; the rule is intentionally blocking.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/require-span-on-exported-effect -- pure data construction; tracing happens at the consumer
export const buildRequest = Effect.gen(function* () {
  return yield* compose(headers, body);
});
```
