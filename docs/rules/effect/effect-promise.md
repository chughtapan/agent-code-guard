# `agent-code-guard/effect-promise`

**What it flags:** `Effect.promise(...)`.

**Why:** `Effect.promise` turns Promise rejections into defects. That throws away the typed error channel and makes downstream recovery less precise than it should be. If a Promise can reject, model that rejection explicitly with `Effect.tryPromise({ try, catch })`.

## Before (flagged)

```ts
const user = yield* Effect.promise(() => fetchUser(id));
```

## After (preferred)

```ts
const user = yield* Effect.tryPromise({
  try: () => fetchUser(id),
  catch: (cause) => new FetchUserError({ id, cause }),
});
```

If the Promise truly cannot reject, document that invariant locally and suppress the line with a reason. Default to `tryPromise`; force the proof to be explicit.

## Disabling per-line

When the promise truly cannot reject — e.g. wrapping a function whose contract is documented infallible — suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/effect-promise -- @types/foo says fooSettled never rejects; verified upstream
const settled = Effect.promise(() => fooSettled());
```
