# `agent-code-guard/no-schema-type-cast`

**What it flags:** Casts to `Schema.Schema.Type<typeof S>`, `Schema.Schema.Encoded<typeof S>`, or the short forms `Schema.Type` / `Schema.Encoded`.

**Why:** A cast asserts the type without validating the value. The whole point of having a `Schema` is to *decode* unknown input through it, so it tells you when the value doesn't match. Casting to the schema's `Type` skips that check and pushes the runtime error somewhere downstream where it's harder to diagnose.

## Before (flagged)

```ts
import { Schema } from "@effect/schema";

const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

const user = JSON.parse(input) as Schema.Schema.Type<typeof UserSchema>; // flagged
```

## After (preferred)

```ts
import { Schema } from "@effect/schema";

const UserSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
});

// Throws if input doesn't match
const user = Schema.decodeUnknownSync(UserSchema)(JSON.parse(input));

// Or, returning Either:
const result = Schema.decodeUnknownEither(UserSchema)(JSON.parse(input));

// Or, returning an Effect (preferred at I/O boundaries):
const effect = Schema.decodeUnknown(UserSchema)(JSON.parse(input));
```

## Variants flagged

All four of these patterns trigger the rule:

- `value as Schema.Schema.Type<typeof S>`
- `value as Schema.Schema.Encoded<typeof S>`
- `value as Schema.Type<typeof S>`
- `value as Schema.Encoded<typeof S>`

## Pairing

This rule is a kin of `agent-code-guard/as-unknown-as` (general unsafe-cast guard) and `no-double-cast`.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/no-schema-type-cast -- post-decode reshape, value already validated above
const reshaped = decoded as Schema.Schema.Type<typeof TargetSchema>;
```
