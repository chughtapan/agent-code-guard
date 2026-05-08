# `agent-code-guard/fork-requires-lifecycle`

**What it flags:** A call to `Effect.fork(...)` whose return value is discarded — i.e., the call appears as a top-level statement (`Effect.fork(x);`), an unassigned `yield*` (`yield* Effect.fork(x);`), or an unassigned `await` of a fork-bearing expression. The resulting `Fiber` has no caller holding it, so its lifecycle is undefined and it likely leaks.

**Why:** `Effect.fork` returns a `Fiber<E, A>`. The fiber runs concurrently with its parent and stays alive until either (a) it completes naturally, (b) someone calls `Fiber.await` / `Fiber.interrupt` on it, or (c) the enclosing scope closes (only when forked via `Effect.forkScoped`). Bare `Effect.fork` doesn't trigger any of those automatically. Discarded forks become orphaned background work that the runtime can't reason about.

## Before (flagged)

```ts
function* program() {
  yield* Effect.fork(backgroundJob); // flagged: Fiber discarded
  yield* doOtherWork();
  // backgroundJob may still be running when program returns — no one is watching
}
```

## After (preferred)

Capture the fiber if you'll await/interrupt:

```ts
function* program() {
  const fiber = yield* Effect.fork(backgroundJob);
  yield* doOtherWork();
  yield* Fiber.await(fiber); // wait for background work
  // or: yield* Fiber.interrupt(fiber); // cancel it
}
```

Use `Effect.forkScoped` for fibers tied to the current scope:

```ts
function* program() {
  yield* Effect.forkScoped(backgroundJob); // auto-interrupts when scope closes
  yield* doOtherWork();
}
```

Use `Effect.forkDaemon` for intentionally long-lived background workers:

```ts
function* bootstrap() {
  yield* Effect.forkDaemon(metricsReporter); // intentionally outlives parent
}
```

## Detection

The rule fires only on `Effect.fork(...)` calls whose result is structurally discarded:

- `Effect.fork(x);` (call as statement)
- `yield* Effect.fork(x);` (yield-expression as statement)
- `await Effect.fork(x);` (await-expression as statement)

It does **not** fire when the result is captured (`const fiber = ...`), passed to another function (`pipe(Effect.fork(x), tap(...))`), or used in a destructuring expression. `Effect.forkScoped` and `Effect.forkDaemon` are exempt — those are the lifecycle-aware variants.

## Pairing

- `runpromise-requires-scoped` (typed) — flags running an Effect that requires Scope without `Effect.scoped`.
- `acquire-release-requires-scope` — flags `Effect.acquireRelease` without an enclosing `Effect.scoped` / `Layer.scoped`.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/fork-requires-lifecycle -- intentionally fire-and-forget; runs to completion before parent returns
yield* Effect.fork(quickReport);
```
