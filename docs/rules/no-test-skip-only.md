# `agent-code-guard/no-test-skip-only`

**What it flags:** In test files (`**/*.test.*`, `**/*.spec.*`, `**/test/**`, `**/tests/**`, `**/__tests__/**`, `**/e2e/**`):

- `it.skip(...)`, `test.skip(...)`, `describe.skip(...)` — skipped tests.
- `it.only(...)`, `test.only(...)`, `describe.only(...)` — focused tests that silently disable everything else.
- `xit(...)`, `xtest(...)`, `xdescribe(...)` — Jest-style aliases for `.skip`.
- `it.skip.each([...])(...)`, `describe.only.each\`...\`(...)` — parameterized skips/onlys in both array and tagged-template forms.

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

## Install pattern

This rule only fires in test files, so your flat config should include a dedicated block that *covers* test files — not one that excludes them. The `recommended` preset excludes tests from prod rules, so a second block is required:

```js
// eslint.config.js
import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  // Prod rules — excludes test files
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
    plugins: { "safer-by-default": guard },
    rules: guard.configs.recommended.rules,
  },
  // Test hygiene — covers test files
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts", "**/tests/**/*.ts"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
    plugins: { "safer-by-default": guard },
    rules: { "agent-code-guard/no-test-skip-only": "error" },
  },
];
```

If your repo's `files:`/`ignores:` globs exclude test files from every linted block, this rule will never fire. See the README for the full recommended layout.

## Options

`{ allow?: ('skip' | 'only')[] }` — default `[]`. Allows per-repo opt-in if you deliberately use one modifier as a workflow (rare; prefer per-line suppression).

```js
// eslint.config.js
{
  rules: {
    "agent-code-guard/no-test-skip-only": ["error", { allow: ["skip"] }],
  },
}
```

## Exceptions

One-off local focus during debugging — suppress per-line and remove before commit:

```ts
// eslint-disable-next-line agent-code-guard/no-test-skip-only -- local debug; revert before commit
it.only("the failing case", () => { /* ... */ });
```

Rationale: a disabled test is a stop-rule-adjacent signal — the thing you almost-but-did-not-commit. Delete it, or commit it green, or suppress per-line with a concrete reason. See the companion plugin's [PRINCIPLES.md — "Stop rules are literal"](https://github.com/chughtapan/agent-code-guard/blob/main/PRINCIPLES.md).
