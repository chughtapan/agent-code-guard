# `safer-by-default/no-manual-enum-cast`

**What it flags:** `as "a" | "b" | "c"` string-union casts (two or more string-literal types).

**Why:** Inlining enum values bypasses your generated types. If the DB has a `status` enum of `'pending' | 'active' | 'archived'`, that union should be imported from the generated types (e.g. Kysely's generated `Database` type, or a codegen'd `schema.ts`). Hand-writing the union means every time you add a value to the enum you have to chase every cast site.

## Before (flagged)

```ts
function renderStatus(row: DbRow) {
  const status = row.status as "pending" | "active" | "archived";
  return <Badge kind={status} />;
}
```

## After (preferred)

```ts
import type { UserStatus } from "./generated/database.js";

function renderStatus(row: DbRow) {
  const status: UserStatus = row.status;
  return <Badge kind={status} />;
}
```

If the source's static type is already the union (e.g. Kysely's `Selectable<UserTable>` column), you don't need a cast at all:

```ts
function renderStatus(row: Selectable<UserTable>) {
  return <Badge kind={row.status} />;
}
```

Notes for agents:
- Look for a generated types file (commonly `generated/database.ts`, `schema.ts`, `db.ts`) and import the union from there.
- If no generated types exist, define the union once in a shared types file and import it everywhere, rather than re-casting at each use site.

## Exceptions

Narrowing an externally-typed value whose real runtime type you know at this specific callsite (e.g. parsing a query-string value that your router validated earlier):

```ts
// eslint-disable-next-line safer-by-default/no-manual-enum-cast -- router guard upstream guarantees these three values
const kind = params.kind as "quick" | "full" | "custom";
```
