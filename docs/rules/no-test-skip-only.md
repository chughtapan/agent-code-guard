# `safer-by-default/no-test-skip-only`

**What it flags:** In test files (`**/*.test.*`, `**/*.spec.*`, `**/test/**`, `**/tests/**`):

- `it.skip(...)`, `test.skip(...)`, `describe.skip(...)` — skipped tests.
- `it.only(...)`, `test.only(...)`, `describe.only(...)` — focused tests that silently disable everything else.
- `xit(...)`, `xtest(...)`, `xdescribe(...)` — Jest-style aliases for `.skip`.

**Why:** A `.skip` in a committed test file is a test that never runs in CI. A `.only` is worse — it silently disables every other test in the same file. Both pass green while coverage regresses. Commit a passing test or delete it.

## Before (flagged)

```ts
it.skip("wip — come back to this", () => { /* ... */ });

describe.only("just this suite", () => { /* ... */ });

xit("disabled because flaky", () => { /* ... */ });
```

## After (preferred)

```ts
it("passes now", () => { expect(thing()).toBe(1); });
```

If you're not ready to land the test, delete it. Git preserves the draft. A skipped test in CI is worse than no test — it signals coverage you do not have.

## Options

`{ allow?: ('skip' | 'only')[] }` — default `[]`. Allows per-repo opt-in if you deliberately use one modifier as a workflow (rare; prefer per-line suppression).

```js
// eslint.config.js
{
  rules: {
    "safer-by-default/no-test-skip-only": ["error", { allow: ["skip"] }],
  },
}
```

## Exceptions

One-off local focus during debugging — suppress per-line and remove before commit:

```ts
// eslint-disable-next-line safer-by-default/no-test-skip-only -- local debug; revert before commit
it.only("the failing case", () => { /* ... */ });
```

See `PRINCIPLES.md` → Principle 7: stop rules are literal. A disabled test is a stop-rule-adjacent signal; escalate or delete, do not skip.
