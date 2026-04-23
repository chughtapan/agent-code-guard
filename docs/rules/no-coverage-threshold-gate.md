# `agent-code-guard/no-coverage-threshold-gate`

**What it flags:** In `jest.config.*`, `vitest.config.*`, and `vite.config.*`:

- `coverageThreshold: { ... }` (Jest)
- `coverage: { thresholds: { ... } }` (Vitest/V8 and Istanbul)
- `coverage: { threshold: { ... } }`

**Why:** Coverage is a diagnostic, not a merge gate. A threshold turns a useful signal into Goodhart bait: developers add trivial tests that touch a line without asserting behavior, the number goes up, and the class of bug the threshold was meant to catch still ships. Read the number on the dashboard. Use it to find code that is not tested; do not use it to block merges.

Background: research on coverage-as-gate vs coverage-as-signal in the companion plugin ([sbd#32](https://github.com/chughtapan/agent-code-guard/issues/32)). Short version: thresholds measure the easy-to-game variable, not the one you want to move.

## Before (flagged) — `jest.config.js`

```js
module.exports = {
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
```

## Before (flagged) — `vitest.config.ts`

```ts
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

## After (preferred)

```ts
export default defineConfig({
  test: {
    coverage: { provider: "v8", reporter: ["text", "html"] },
  },
});
```

Report, do not gate. If a PR materially drops coverage, the reviewer sees it in the report and decides.

## Scope

This rule runs on filenames matching:

- `jest.config.*`, `vitest.config.*`, `vite.config.*` — including named variants like `vitest.config.unit.ts` or `jest.config.integration.cjs`.
- Extensions: `.js`, `.ts`, `.mjs`, `.cjs`, `.mts`, `.cts`.
- `package.json` — listed for future compatibility. The stock ESLint JS parser will not parse JSON; wire [`jsonc-eslint-parser`](https://www.npmjs.com/package/jsonc-eslint-parser) or `eslint-plugin-jsonc` and re-run to lint Jest's `jest.coverageThreshold` key in `package.json`.

## Exceptions

If your org genuinely requires a coverage floor (regulated industry, SOC 2 control), suppress per-config with a one-line note:

```ts
// eslint-disable-next-line agent-code-guard/no-coverage-threshold-gate -- SOC 2 control CC7.2 requires ≥80% line coverage
coverageThreshold: { global: { lines: 80 } },
```

Severity defaults to `warn` in the `recommended` preset — the signal is advisory, not a hard stop.
