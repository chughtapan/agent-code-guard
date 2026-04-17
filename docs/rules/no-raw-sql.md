# `safer-by-default/no-raw-sql`

**What it flags:** `.query(...)` calls where the first argument looks like SQL (starts with `SELECT`/`INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP`/`WITH`, in a string literal or template literal) or uses a `` sql`...` `` tagged template.

**Why:** Raw SQL strings disconnect the query from the generated database types. Typos surface at runtime instead of compile time, result-row fields are `unknown`, and refactors to the schema leave stale SQL behind. Use a typed query builder so column names, parameter types, and result shapes are all checked by the compiler.

## Before (flagged)

```ts
const users = await db.query("SELECT id, name FROM users WHERE org_id = $1", [orgId]);
const count = await db.query(`UPDATE sessions SET expired = true WHERE id = ${id}`); // also SQL injection
```

## After (preferred) — Kysely

```ts
const users = await db
  .selectFrom("users")
  .where("org_id", "=", orgId)
  .select(["id", "name"])
  .execute();

const { numUpdatedRows } = await db
  .updateTable("sessions")
  .set({ expired: true })
  .where("id", "=", id)
  .executeTakeFirst();
```

## After (preferred) — Drizzle

```ts
const users = await db
  .select({ id: usersTable.id, name: usersTable.name })
  .from(usersTable)
  .where(eq(usersTable.orgId, orgId));
```

Notes for agents:
- If you see `pool.query(...)` / `client.query(...)` / `db.query(...)`, the fix is to rewrite it against the query builder instance (often called `db` or `kysely`).
- For one-off queries the builder can't express, most builders expose an `sql` template helper with parameter binding (e.g. Kysely's `sql<ResultRow>\`...\``). Use that, not raw `.query()`.
- Never interpolate user input into a SQL string. Use parameters.

## Exceptions

Migration scripts, ad-hoc admin tools, or raw-SQL benchmarks where the typed builder isn't appropriate:

```ts
// eslint-disable-next-line safer-by-default/no-raw-sql -- migration: one-off DDL, runs once
await db.query("CREATE INDEX CONCURRENTLY idx_users_email ON users(email)");
```
