# `agent-code-guard/manual-brand`

**What it flags:** reusable nominal-typing surfaces built with marker fields like `__brand`, `_brand`, or `brand`, plus cast helpers that only launder values into those aliases.

**Why:** handwritten brand aliases drift fast. They create local conventions for nominal typing, and the corresponding `as UserId` helpers usually skip the one place branding should happen: an explicit constructor or schema boundary. `Brand.nominal(...)` and `Schema.brand(...)` give you a standard construction path instead.

This rule is advisory in the recommended preset (`warn`), because a repo may still be migrating older nominal helpers.

## Before (flagged)

```ts
type UserId = string & { readonly __brand: "UserId" };

const asUserId = (value: string): UserId => value as UserId;
```

## After (preferred) — `Brand.nominal(...)`

```ts
import { Brand } from "effect";

export type UserId = string & Brand.Brand<"UserId">;
export const UserId = Brand.nominal<UserId>();
```

## After (preferred) — `Schema.brand(...)`

```ts
const UserIdSchema = Schema.String.pipe(Schema.brand("UserId"));
```

Incidental payload fields like `{ brand: string }` stay out of scope. The rule only reports reusable nominal-typing abstractions, not ordinary transport metadata.
