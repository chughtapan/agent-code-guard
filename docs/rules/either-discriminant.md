# `safer-by-default/either-discriminant`

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
