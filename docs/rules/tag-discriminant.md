# `agent-code-guard/tag-discriminant`

**What it flags:** manual `_tag` comparisons on tagged errors, such as `err._tag === "WebhookTimeoutError"`.

**Why:** if the failure lives in the Effect error channel, recovery should happen in the Effect pipeline. `Effect.catchTag(...)` and `Effect.catchTags(...)` keep the dispatch declarative and preserve type flow. A manual `_tag` check pulls that logic back out into ad hoc control flow.

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
