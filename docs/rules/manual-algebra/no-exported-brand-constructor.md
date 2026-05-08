# `agent-code-guard/no-exported-brand-constructor`

**What it flags:** exported brand constructors and schema constructors:
`Brand.nominal(...)`, Effect `Schema.*`, Zod `z.*`, and TypeBox `Type.*`
values.

**Why:** exported constructors become part of the public contract. They
let consumers construct domain values directly instead of going through a
package-owned parser, decoder, or factory that can enforce invariants.
Keep constructors local; export derived types and boundary functions.

This rule warns because some packages intentionally expose schema objects
while migrating to a narrower API.

## Before (flagged)

```ts
export const UserId = Brand.nominal<UserId>();

export const UserSchema = z.object({ id: z.string() });
```

## After (preferred)

```ts
const UserId = Brand.nominal<UserId>();
const UserSchema = z.object({ id: z.string() });

export type User = z.infer<typeof UserSchema>;
export const parseUser = (input: unknown): User => UserSchema.parse(input);
```

Named re-exports of local constructors are also flagged:

```ts
const UserSchema = z.object({ id: z.string() });
export { UserSchema };
```

## Options

The rule has no configuration.

## Disabling per-line

If a package's public API is intentionally a schema (e.g., a validation library that exports its `Schema.*` for downstream composition), suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/no-exported-brand-constructor -- public schema is the package's contract
export const UserSchema = z.object({ id: z.string() });
```
