# `agent-code-guard/tag-discriminant`

**What it flags:** manual `_tag` comparisons and `switch (_tag)` statements where the receiver's type is an Effect-flavored tagged union — `Effect`, `Either`, `Option`, `Exit`, `Cause`, `Fiber`, `Stream`, `ParseResult`, `Data.TaggedError`, `Data.TaggedClass`, `Data.TaggedEnum`.

**Why:** if the value lives in the Effect ecosystem, dispatch should use the Effect ecosystem's combinators. `Effect.catchTag(...)` / `Effect.catchTags(...)` for tagged errors; `Match.tag(...)` / `Match.discriminator('_tag')` for tagged unions. A manual `_tag` check pulls that logic back out into ad hoc control flow and breaks type narrowing through pipelines.

**Type-aware.** This rule needs TypeScript program services to identify Effect-flavored types. Apply it to files covered by a `parserOptions.project` configuration — without type info, the rule silently skips. Non-Effect tagged unions (Redux Toolkit actions, fp-ts `Either`, custom user tagged unions) are not flagged.

## Before (flagged)

```ts
const exit = yield* Effect.either(program);
if (exit._tag === "Left") {
  const err = exit.left;
  if (err._tag === "WebhookTimeoutError") {
    return fallback;
  }
}
```

## After (preferred)

```ts
const value = yield* program.pipe(
  Effect.catchTag("WebhookTimeoutError", () => Effect.succeed(fallback)),
);
```

Use `catchTags` when multiple tagged failures share the same boundary.

## Disabling per-line

For one-off cases where `catchTag` doesn't fit (e.g., extracting the tag for a logger), suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/tag-discriminant -- structured-log field extraction
logger.error({ kind: error._tag, raw: error });
```
