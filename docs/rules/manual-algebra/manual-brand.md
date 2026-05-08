# `agent-code-guard/manual-brand`

**What it flags:** reusable nominal-typing surfaces built with marker fields like `__brand`, `_brand`, or `brand`.

**Why:** handwritten brand aliases drift fast. They create local conventions for nominal typing instead of using a shared construction path. `Brand.nominal(...)` and `Schema.brand(...)` give you a standard boundary instead.

This rule is advisory in the recommended preset (`warn`), because a repo may still be migrating older nominal helpers.

## Before (flagged)

```ts
type UserId = string & { readonly __brand: "UserId" };
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

Incidental payload fields like `{ brand: string }` stay out of scope. The rule only reports reusable nominal-typing abstractions, not ordinary transport metadata. Cast constructors such as `asUserId` are handled separately by `no-manual-brand-constructor`.

## Disabling per-line

If a hand-rolled brand is intentional (e.g., a brand declared in a package that does not depend on Effect), suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/manual-brand -- this package cannot take an Effect dependency
type UserId = string & { readonly __brand: "UserId" };
```
