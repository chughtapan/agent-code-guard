# `agent-code-guard/either-discriminant`

**What it flags:** manual Either narrowing via `Either.isLeft(...)`, `Either.isRight(...)`, or `_tag === "Left" / "Right"`.

**Why:** manual discriminants spread Either handling across conditionals and switches. `Either.match(...)` keeps both branches together and makes the intent explicit.

## Before (flagged)

```ts
if (Either.isLeft(decoded)) {
  return decoded.left.message;
}
return decoded.right;
```

## After (preferred)

```ts
return Either.match({
  onLeft: (err) => err.message,
  onRight: (value) => value,
})(decoded);
```

If the Either exists only to bridge into Effect code, prefer lifting it immediately and staying in the Effect pipeline.

## Disabling per-line

For a single bridge into non-Effect code that genuinely needs `_tag`-shape access, suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/either-discriminant -- exporting to a JSON wire format that uses the tag literally
return { ok: result._tag === "Right", value: result.right };
```
