# `agent-code-guard/no-raw-sql`

**What it flags:** `.query(...)` calls where the first argument looks like SQL (starts with `SELECT`/`INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP`/`WITH`, in a string literal or template literal) or uses a `` sql`...` `` tagged template.

**Why:** Raw SQL strings disconnect the query from the generated database types. Typos surface at runtime instead of compile time, result-row fields are `unknown`, and refactors to the schema leave stale SQL behind. Use a typed SQL boundary so column names, parameter types, and result shapes are all checked by the compiler.

## Before (flagged)

```ts
const users = await db.query("SELECT id, name FROM users WHERE org_id = $1", [orgId]);
const count = await db.query(`UPDATE sessions SET expired = true WHERE id = ${id}`); // also SQL injection
```

## After — typed query builders / SQL adapters

The rule does not prescribe a specific tool. Examples of typed SQL boundaries:

**Kysely:**

```ts
const users = await db
  .selectFrom("users")
  .where("org_id", "=", orgId)
  .select(["id", "name"])
  .execute();
```

**Drizzle:**

```ts
const users = await db
  .select({ id: usersTable.id, name: usersTable.name })
  .from(usersTable)
  .where(eq(usersTable.orgId, orgId));
```

**`@effect/sql`:**

```ts
const users = yield* sql<User>`SELECT id, name FROM users WHERE org_id = ${orgId}`;
```

## Options

```ts
{
  recommend?: string; // tool name to surface in the rule message
}
```

When `recommend` is set, the rule message reads:
`Raw SQL in .query(); use <tool> or another typed SQL boundary`

Example:

```jsonc
{
  "agent-code-guard/no-raw-sql": ["error", { "recommend": "@effect/sql" }]
}
```

Default (no option): `Raw SQL in .query(); use a typed SQL boundary` — tool-agnostic.

## Notes for agents

- If you see `pool.query(...)` / `client.query(...)` / `db.query(...)`, rewrite it against your project's typed SQL boundary.
- For one-off queries the builder can't express, most adapters expose a parameterized `sql` template helper. Use that, not raw `.query()`.
- Never interpolate user input into a SQL string. Use parameters.

## Exceptions

Migration scripts, ad-hoc admin tools, or raw-SQL benchmarks where the typed boundary isn't appropriate:

```ts
// eslint-disable-next-line agent-code-guard/no-raw-sql -- migration: one-off DDL, runs once
await db.query("CREATE INDEX CONCURRENTLY idx_users_email ON users(email)");
```
