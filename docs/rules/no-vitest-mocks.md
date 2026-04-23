# `agent-code-guard/no-vitest-mocks`

**What it flags:** `vi.mock(...)`, `vi.hoisted(...)`, and `vi.spyOn(...)` calls.

**Why:** This rule is intended to be scoped (via your flat config's `files:` filter) to integration tests. The philosophy: integration tests exist to catch real-dependency failures — database constraints, serialization edge cases, network flakes, misconfigured env vars. A `vi.mock()` in an integration test quietly replaces the real dependency with a fiction, and the test can pass while production breaks. If you need to stub a dependency, you're writing a unit test; move it.

## Before (flagged) — in `*.integration.test.ts`

```ts
import { vi } from "vitest";

vi.mock("./db", () => ({ users: { find: vi.fn().mockResolvedValue({ id: 1 }) } }));

test("finds user", async () => {
  const user = await service.findUser(1);
  expect(user.id).toBe(1);
});
```

## After (preferred) — in `*.integration.test.ts`

```ts
import { db } from "./db"; // real instance pointed at the test DB
import { applyMigrations, truncateAll } from "./test-db.js";

beforeAll(async () => {
  await applyMigrations(db);
});

beforeEach(async () => {
  await truncateAll(db);
  await db.insertInto("users").values({ id: 1, name: "Alice" }).execute();
});

test("finds user", async () => {
  const user = await service.findUser(1);
  expect(user).toMatchObject({ id: 1, name: "Alice" });
});
```

Real test DBs are cheap: `docker compose` or [testcontainers](https://testcontainers.com/) give you one per test run in seconds.

Notes for agents:
- If the test file is `*.test.ts` (unit) rather than `*.integration.test.ts`, this rule shouldn't apply — check the file name and your flat config's `files:` scope.
- If you must stub network calls, prefer an HTTP-level interceptor (e.g. [msw](https://mswjs.io/)) over a module mock, so the test still exercises your real HTTP client code.

## Exceptions

A specific dependency is genuinely out-of-scope for integration testing (e.g. a paid third-party API with no sandbox), and you need to stub only that one:

```ts
// eslint-disable-next-line agent-code-guard/no-vitest-mocks -- third-party billing API has no sandbox
vi.mock("./stripe-client", () => ({ charge: vi.fn().mockResolvedValue({ id: "ch_test" }) }));
```
