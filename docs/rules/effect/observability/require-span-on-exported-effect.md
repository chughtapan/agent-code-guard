# `agent-code-guard/require-span-on-exported-effect`

> **Severity: `error`** — exported Effect entrypoints are mandatory trace
> boundaries in both main presets.

**What it flags:**

- An exported function that returns one Effect and sets that Effect's span by hand: a bare `Effect.gen(...)`, or a `.pipe(...)` with `Effect.withSpan("name")` among its steps. Define it with `Effect.fn("name")`.
- Any other exported `Effect.gen` definition that does not reference `withSpan` anywhere.

**Why:** Spans are how you find your program in production. An exported Effect surface that has no span is invisible — when something downstream is slow or failing, the trace stops at the caller and starts again somewhere later. Naming the span at the export boundary gives every consumer a consistent label to filter against.

`Effect.fn("name")` opens a span called `name` on every call and records where the function was defined and called, so a function written that way needs no `Effect.gen` wrapper and no trailing `withSpan`.

## Before (flagged)

```ts
import { Effect } from "effect";

export function loadUser(id: string) {
  return Effect.gen(function* () {
    return yield* fetchUser(id);
  }).pipe(Effect.withSpan("loadUser"));
}

export const loadCurrentUser = Effect.gen(function* () {
  const id = yield* readId;
  return yield* fetchUser(id);
});
```

## After (preferred)

```ts
export const loadUser = Effect.fn("loadUser")(function* (id: string) {
  return yield* fetchUser(id);
});

export const loadCurrentUser = Effect.gen(function* () {
  const id = yield* readId;
  return yield* fetchUser(id);
}).pipe(Effect.withSpan("loadCurrentUser"));
```

## What the autofix covers

The fix applies when the rewrite is mechanical: the function returns `Effect.gen(...)` with nothing piped on but its own span, and declares no return type. It turns a function declaration into a `const`, which is not hoisted; TypeScript reports a module-level use that now comes before the definition.

The other cases are reported and rewritten by hand:

```ts
// Other pipe steps follow the body. A step that needs the arguments receives them after the effect.
export const loadUser = Effect.fn("loadUser")(
  function* (id: string) {
    return yield* fetchUser(id);
  },
  (effect, id) => effect.pipe(scopedTo(id)),
);

// A pipeline with no generator is a plain function.
export const loadName = Effect.fn("loadName")((id: string) =>
  fetchUser(id).pipe(Effect.map((user) => user.name)),
);
```

A declared return type moves to the constant or is left to inference.

## What the rule leaves alone

- A function that runs statements before returning its Effect.
- A span given options, as in `Effect.withSpan("name", { attributes: { id } })`, since the options may read the function's arguments.

Both still need a `withSpan` reference somewhere in the definition.

## What counts as "has a span"

For exports that are not rewritten to `Effect.fn`: any reference to `withSpan` in the subtree of the exported declaration — whether it's `Effect.withSpan(...)`, `pipe(_, Effect.withSpan(...))`, or imported and called as `withSpan(...)`. The rule is a structural check, not a semantic one: if the identifier appears, the rule trusts you.

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
