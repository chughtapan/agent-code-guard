# `agent-code-guard/finalizer-requires-scope`

**What it flags:** A call to `Scope.addFinalizer(...)` in a file that never references `scoped` (no `Effect.scoped`, `Layer.scoped`, or `scopedDiscard` anywhere). Without an enclosing `Scope` the finalizer is never run.

**Why:** `Scope.addFinalizer` registers a cleanup callback against the *current* scope. If no scope is in scope (sorry), the registration silently no-ops and the cleanup never runs. The bug shows up as a leak in production, not as a runtime error.

## Before (flagged)

```ts
const program = Effect.gen(function* () {
  const handle = yield* openHandle;
  yield* Scope.addFinalizer(
    Effect.sync(() => handle.close()),
  );
  return yield* useHandle(handle);
});
// caller calls Effect.runPromise(program) — no scope wrapper, finalizer never fires
```

## After (preferred)

```ts
const program = Effect.scoped(
  Effect.gen(function* () {
    const handle = yield* openHandle;
    yield* Scope.addFinalizer(
      Effect.sync(() => handle.close()),
    );
    return yield* useHandle(handle);
  }),
);
```

Or push the scope frame to a layer:

```ts
const HandleLayer = Layer.scoped(
  HandleTag,
  Effect.gen(function* () {
    const handle = yield* openHandle;
    yield* Scope.addFinalizer(
      Effect.sync(() => handle.close()),
    );
    return handle;
  }),
);
```

## Pairing

- `acquire-release-requires-scope` — the `Effect.acquireRelease` analogue. Use that helper in preference to manual `Scope.addFinalizer` when you can.
- `runpromise-requires-scoped` (typed) — catches running a Scope-requiring Effect at the boundary.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/finalizer-requires-scope -- caller provides the scope; module is reusable
yield* Scope.addFinalizer(close);
```
