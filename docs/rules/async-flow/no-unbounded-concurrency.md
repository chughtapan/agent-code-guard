# `agent-code-guard/no-unbounded-concurrency`

**What it flags:** `Effect.*(..., { concurrency: "unbounded" })`.

**Why:** unbounded fan-out quietly turns one Effect into “launch everything right now.” That is usually how connection pools, remote APIs, queues, and callback-heavy flows get hammered. Use an explicit numeric bound so the throughput decision stays visible in code review.

## Before (flagged)

```ts
yield* Effect.all(tasks, { concurrency: "unbounded" });
```

## After (preferred)

```ts
yield* Effect.all(tasks, { concurrency: 8 });
```

If the work is truly safe to launch all at once, suppress the line with a reason and make the proof explicit there.

## Disabling per-line

If the work is truly safe to launch all at once (e.g., a fixed-size array of independent reads with proven low fan-out), suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/no-unbounded-concurrency -- fan-out bounded to 5 statically; benchmarked
yield* Effect.all(reads, { concurrency: "unbounded" });
```
