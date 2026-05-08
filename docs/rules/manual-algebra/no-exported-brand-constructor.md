# `agent-code-guard/no-exported-brand-constructor`

**What it flags:** exported brand constructors and schema constructors:
`Brand.nominal(...)`, Effect `Schema.*`, Zod `z.*`, and TypeBox `Type.*`
values.

**Why:** the module that owns the schema should also own the codec. If
you `export const X = Schema.Struct(...)`, every consumer now has to
call `Schema.decodeUnknownSync(X)(input)` themselves — the codec choice
(parse vs decode, sync vs async, error formatting) leaks across the
boundary, and you can't change it without breaking consumers. Keep
schemas local. Export `parseFoo` / `encodeFoo` / a derived type instead.

This stance is intentional. The rule is **not** trying to flag every
Effect Schema or Zod usage; it flags exports that hand the *raw schema*
to consumers. Internal `const X = Schema.Struct(...)` plus
`export function parseFoo(input: unknown): Foo { ... }` is the
preferred shape. The rule warns (not errors) so packages migrating to
a narrower API can do it incrementally.

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
