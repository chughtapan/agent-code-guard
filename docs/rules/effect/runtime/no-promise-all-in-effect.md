# `agent-code-guard/no-promise-all-in-effect`

**What it flags:** `Promise.all`, `Promise.allSettled`, `Promise.race`, and `Promise.any` calls inside files that import from `"effect"` or any `"@effect/*"` package.

**Why:** Effect has its own concurrency primitives (`Effect.all`, `Effect.forEach`, `Effect.race`, `Effect.raceFirst`) that compose with the runtime's interruption, scope, and concurrency-limit semantics. `Promise.all` runs everything unbounded and uncancellable, which is the wrong default in an Effect codebase.

## Before (flagged)

```ts
import { Effect } from "effect";

const results = await Promise.all([
  fetch("/a"),
  fetch("/b"),
  fetch("/c"),
]);
```

## After (preferred)

```ts
import { Effect } from "effect";

const fetches = [
  Effect.tryPromise(() => fetch("/a")),
  Effect.tryPromise(() => fetch("/b")),
  Effect.tryPromise(() => fetch("/c")),
];

// Bounded concurrency, interruptible, runtime-aware:
const results = yield* Effect.all(fetches, { concurrency: 3 });
```

For arrays driven by data, prefer `Effect.forEach`:

```ts
const results = yield* Effect.forEach(urls, (url) => fetchEffect(url), {
  concurrency: 5,
});
```

For first-wins, use `Effect.race`. For first-success-or-all-failed, use `Effect.raceAll`.

## Pairing rules

- `no-unbounded-concurrency`: catches `Effect.all({ concurrency: "unbounded" })`, the Effect-side equivalent of unbounded `Promise.all`.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/no-promise-all-in-effect -- batched in-process work, no I/O, no Effect runtime needed here
const results = await Promise.all(localComputations);
```
