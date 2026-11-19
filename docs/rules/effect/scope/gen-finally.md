# `agent-code-guard/gen-finally`

**What it flags:** A `try` statement with a `finally` block whose nearest enclosing function is a generator that Effect drives: one passed to `Effect.gen(...)`, `Effect.fn(...)`, `Effect.fn("name")(...)`, or `Effect.fnUntraced(...)`.

**Why:** Effect runs the generator one `yield*` at a time. When a yielded effect fails, Effect stops calling the generator: it does not throw the failure into it and does not call `.return()`. The `try` block is abandoned mid-`yield*` and the `finally` block never runs, so the cleanup is skipped on exactly the path it was written for. `Effect.ensuring` and `Effect.acquireRelease` attach the cleanup to the effect itself, where it runs on success, failure, and interruption.

## Before (flagged)

```ts
const program = Effect.gen(function* () {
  const handle = yield* openHandle;
  try {
    return yield* useHandle(handle); // if this fails, the finally below is skipped
  } finally {
    handle.close();
  }
});
```

## After (preferred)

Attach the cleanup with `Effect.ensuring`:

```ts
const program = Effect.gen(function* () {
  const handle = yield* openHandle;
  return yield* useHandle(handle).pipe(
    Effect.ensuring(Effect.sync(() => handle.close())),
  );
});
```

Or pair acquisition with release:

```ts
const program = Effect.scoped(
  Effect.gen(function* () {
    const handle = yield* Effect.acquireRelease(openHandle, (opened) =>
      Effect.sync(() => opened.close()),
    );
    return yield* useHandle(handle);
  }),
);
```

## Detection

Only the nearest enclosing function decides. The rule does **not** fire on:

- a plain generator, including one declared inside an Effect generator — iteration runs its `finally` through `.return()`;
- an arrow function or ordinary function inside an Effect generator — a synchronous `try/finally` there completes normally;
- `try/catch` with no `finally`;
- a generator that reaches `Effect.gen` through a variable rather than as an inline argument.

## Pairing

- `acquire-release-requires-scope` — flags `Effect.acquireRelease` without an enclosing `Effect.scoped` / `Layer.scoped`.
- `finalizer-requires-scope` — flags `Scope.addFinalizer` outside scoped context.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/gen-finally -- the try body yields nothing; the finally only resets a synchronous flag
try {
  compute();
} finally {
  busy = false;
}
```
