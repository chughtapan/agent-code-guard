# `safer-by-default/then-chain`

**What it flags:** Any `.then(...)` method call.

**Why:** A `.then()` chain is the escape hatch back into untyped-error promise-land. If you're composing asynchronous operations, use `Effect.flatMap` / `Effect.map` / `Effect.tap`. If you're consuming a raw `Promise` from a third-party API, wrap it once at the boundary with `Effect.promise` or `Effect.tryPromise`, then compose in Effect-space.

## Before (flagged)

```ts
fetchUser(id).then((u) => enrichProfile(u)).then((p) => render(p));
```

## After (preferred)

```ts
import { Effect } from "effect";

Effect.tryPromise({ try: () => fetchUser(id), catch: (e) => new FetchError({ cause: e }) }).pipe(
  Effect.flatMap((u) => enrichProfile(u)),
  Effect.map((p) => render(p)),
);
```

Or, using `Effect.gen`:

```ts
Effect.gen(function* () {
  const user = yield* Effect.tryPromise({ try: () => fetchUser(id), catch: (e) => new FetchError({ cause: e }) });
  const profile = yield* enrichProfile(user);
  return render(profile);
});
```

Notes for agents:
- `.then(f)` where `f` returns a value → `Effect.map(f)`.
- `.then(f)` where `f` returns a `Promise` or `Effect` → `Effect.flatMap(f)`.
- `.then(onOk, onErr)` → `Effect.matchEffect({ onSuccess: onOk, onFailure: onErr })`.

## Exceptions

Consuming a raw `PromiseLike` from an external library at the edge of your code:

```ts
// eslint-disable-next-line safer-by-default/then-chain -- SDK returns PromiseLike at this boundary; wrap at callsite
externalSdk.doThing().then(processResult);
```

Prefer the wrapper pattern — `Effect.tryPromise(() => externalSdk.doThing())` — whenever you can.
