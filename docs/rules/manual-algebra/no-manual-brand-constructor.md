# `agent-code-guard/no-manual-brand-constructor`

**What it flags:** reusable constructor helpers that create branded values
by casting, such as `asUserId`, `makeUserId`, `toUserId`, or a function
named exactly like the target brand.

**Why:** a cast helper makes branding look deliberate while still accepting
any input of the underlying type. Branding should happen at a boundary:
through `Brand.nominal(...)`, `Schema.brand(...)`, or a parser/decoder that
validates the input before constructing the branded value.

This rule is advisory in the recommended preset (`warn`) so projects can
migrate older nominal helpers incrementally.

## Before (flagged)

```ts
const asUserId = (value: string): UserId => value as UserId;

function makeUserId(value: string) {
  return value as UserId;
}
```

## After (preferred) — `Brand.nominal(...)`

```ts
import { Brand } from "effect";

export type UserId = string & Brand.Brand<"UserId">;

const UserId = Brand.nominal<UserId>();

export const parseUserId = (value: string): UserId => UserId(value);
```

## After (preferred) — schema boundary

```ts
const UserIdSchema = Schema.String.pipe(Schema.brand("UserId"));

export const parseUserId = Schema.decodeUnknownSync(UserIdSchema);
```

The rule only reports direct cast constructors with constructor-like
names. Neutral projection helpers such as `project(value): UserId =>
value as UserId` stay out of scope.

## Options

The rule has no configuration.

## Disabling per-line

If a cast helper is genuinely the right shape (e.g., a compile-time assertion at a generated-code boundary), suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/no-manual-brand-constructor -- generated-code boundary; values pre-validated by codegen
const asUserId = (value: string): UserId => value as UserId;
```
