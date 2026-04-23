# `safer-by-default/as-unknown-as`

**What it flags:** `as unknown as` cast chains.

**Why:** `as unknown as` is a type-system escape hatch. It bypasses validation, hides shape mismatches during refactors, and usually means the code skipped the real boundary step: decode, narrow, or construct a typed value.

## Before (flagged)

```ts
const row = raw as unknown as UserRow;
```

## After (preferred) — decode

```ts
const row = yield* Schema.decodeUnknown(UserRowSchema)(raw);
```

## After (preferred) — narrow

```ts
if (!isUserRow(raw)) {
  return yield* Effect.fail(new InvalidUserRow({ raw }));
}
const row = raw;
```

Allowed exceptions should be rare and local, with an inline suppression reason.
