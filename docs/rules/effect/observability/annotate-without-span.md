# `agent-code-guard/annotate-without-span`

**What it flags:** A call to `Effect.annotateCurrentSpan(...)` in a file that never references `withSpan`. Without an enclosing `withSpan` frame, the annotation has nothing to attach to.

**Why:** `annotateCurrentSpan` modifies the *current* span — but if no span is open in scope, the call silently no-ops. You think you're attaching `{ userId, route }` to a trace; you're actually attaching to nothing. The bug shows up as missing fields in your tracing backend, not as a runtime error.

The rule's heuristic is structural and file-scoped: if the file has any `withSpan` reference (call, member access, imported binding), the rule trusts you. If it has none, every `annotateCurrentSpan` call in the file is flagged.

## Before (flagged)

```ts
import { Effect } from "effect";

const program = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan({ userId: id }); // no current span exists
  yield* doWork;
});
```

## After (preferred)

```ts
import { Effect } from "effect";

const program = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan({ userId: id });
  yield* doWork;
}).pipe(Effect.withSpan("program"));
```

Or, attach the annotation per-call to a wrapped span:

```ts
const program = Effect.gen(function* () {
  yield* doWork;
}).pipe(
  Effect.withSpan("program"),
  Effect.annotateSpans({ userId: id }),
);
```

## What counts as "has a span"

The rule looks for any reference to `withSpan` in the file — a call expression, a member access, an imported binding. If the literal `withSpan` appears anywhere, the rule trusts that span coverage exists.

This is conservative on purpose. False positives (file has spans but rule doesn't see them) are the worse failure mode than false negatives (rule misses a real issue), so the rule errs toward firing only when no span machinery is visible.

## Pairing

- `require-span-on-exported-effect` — the upstream rule: ensures exported Effects have a span at all.
- `handler-requires-span` — the request-boundary version.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/annotate-without-span -- caller wraps with withSpan; this module is reusable across span topologies
yield* Effect.annotateCurrentSpan({ userId: id });
```
