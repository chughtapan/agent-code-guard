# `agent-code-guard/effect-foreach-requires-concurrency`

**What it flags:** `Effect.forEach(...)` calls that don't pass an explicit `concurrency` option.

**Why:** `Effect.forEach` defaults to **sequential** execution (`concurrency: 1`). For I/O-heavy work, that's almost always wrong — you wait for every request to finish before starting the next, when the whole point of running them as Effects is that the runtime can interleave them. For pure work, sequential is fine but you should still say so explicitly so future readers don't have to guess.

The pairing rule `no-unbounded-concurrency` catches the *opposite* mistake — saying `concurrency: "unbounded"` and creating a thundering herd. This rule catches the silent default. Together they push every `forEach` to a written, intentional concurrency policy.

## Before (flagged)

```ts
const results = yield* Effect.forEach(userIds, (id) => loadUser(id));
// silently sequential — N round trips paid one-at-a-time
```

## After (preferred)

Bounded:

```ts
const results = yield* Effect.forEach(userIds, (id) => loadUser(id), {
  concurrency: 10,
});
```

Inherit from runtime (use only when the runtime sets a sensible cap):

```ts
const results = yield* Effect.forEach(userIds, (id) => loadUser(id), {
  concurrency: "inherit",
});
```

Sequential by intent (rare, but valid):

```ts
const results = yield* Effect.forEach(steps, runStep, { concurrency: 1 });
```

## What counts as "explicit"

Any `concurrency` key in the options object — number, `"unbounded"`, `"inherit"`. The rule doesn't read the value; it just requires the key to exist so that the policy is in the source.

## Pairing

- `no-unbounded-concurrency` — catches `concurrency: "unbounded"` literals (the other end of the spectrum).
- `no-promise-all-in-effect` — replaces `Promise.all` with `Effect.all` / `Effect.forEach` in Effect files.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/effect-foreach-requires-concurrency -- order matters; sequential is intentional
yield* Effect.forEach(steps, applyStep);
```
