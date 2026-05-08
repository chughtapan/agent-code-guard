# `agent-code-guard/handler-requires-span`

> **Severity: `warn`** — same observability-adoption posture as `require-span-on-exported-effect`. Bumping to `error` is a follow-up after span coverage is the team norm.

**What it flags:** An `Effect.gen(...)` body inside a **handler-shaped file** (any of: under `handlers/` or `routes/`, or named `*-handler.*` / `*.handler.*` / `*-route.*` / `*.route.*`) that doesn't reference `Effect.withSpan` in its enclosing pipe-chain. Handlers are trace boundaries — a request comes in, a handler runs, a span should bracket the work.

**Why:** Handlers are the natural unit of work for traces. Without a span at the handler level, every downstream operation shows up as an orphan trace fragment. Spans are also the natural place to attach request-correlated annotations (user id, route, version), and you can't `annotateCurrentSpan` without an enclosing span frame.

## Before (flagged)

`src/handlers/users.ts`:

```ts
import { Effect } from "effect";

export const handleGetUser = Effect.gen(function* () {
  const id = yield* readId;
  return yield* fetchUser(id);
});
```

## After (preferred)

Inline:

```ts
export const handleGetUser = Effect.gen(function* () {
  const id = yield* readId;
  return yield* fetchUser(id);
}).pipe(Effect.withSpan("GET /users/:id"));
```

Or wrap step:

```ts
export const handleGetUser = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan({ route: "GET /users/:id" });
  const id = yield* readId;
  return yield* fetchUser(id);
}).pipe(Effect.withSpan("handleGetUser"));
```

## What counts as a handler file

The rule's filename matcher fires on:

- `**/handlers/**`, `**/handler/**`
- `**/routes/**`, `**/route/**`
- `**/*-handler.{ts,mts,cts,tsx,js,...}`, `**/*.handler.{ts,...}`
- `**/*-route.{ts,...}`, `**/*.route.{ts,...}`

Customize via flat-config `files: [...]` and ignores if these heuristics don't match your layout.

## What counts as "has a span"

The same `withSpan` reference inside the enclosing pipe-chain that satisfies `require-span-on-exported-effect`. The rule walks up through `.pipe()` calls so `Effect.gen(...).pipe(Effect.tap(...), Effect.withSpan(...))` counts.

## Pairing

- `require-span-on-exported-effect` — broader version that fires on every exported Effect.gen, not just handler files. Co-fires with this one when the exported handler also lacks a span.
- `annotate-without-span` — flags `Effect.annotateCurrentSpan` calls outside an enclosing `withSpan` frame.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/handler-requires-span -- thin pass-through; downstream effect already wrapped in withSpan
export const handleHealth = Effect.gen(function* () {
  return yield* healthCheck;
});
```
