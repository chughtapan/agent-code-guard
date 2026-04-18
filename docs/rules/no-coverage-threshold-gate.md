# `safer-by-default/no-coverage-threshold-gate`

**What it flags:** In `jest.config.*`, `vitest.config.*`, and `vite.config.*`:

- `coverageThreshold: { ... }` (Jest)
- `coverage: { thresholds: { ... } }` (Vitest/V8 and Istanbul)
- `coverage: { threshold: { ... } }`

**Why:** Coverage is a diagnostic, not a merge gate. A threshold turns a useful signal into Goodhart bait: developers add trivial tests that touch a line without asserting behavior, the number goes up, and the class of bug the threshold was meant to catch still ships. Read the number on the dashboard. Use it to find code that is not tested; do not use it to block merges.

Background: see sbd#32 — research on coverage-as-gate vs coverage-as-signal.

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

This rule runs only inside `jest.config.*`, `vitest.config.*`, and `vite.config.*` (JS/TS). Threshold gates in `package.json` (Jest's `jest.coverageThreshold`) are not linted by this rule — JSON needs a separate parser plugin. Track as follow-up if you need that.

## Exceptions

If your org genuinely requires a coverage floor (regulated industry, SOC 2 control), suppress per-config with a one-line note:

```ts
// eslint-disable-next-line safer-by-default/no-coverage-threshold-gate -- SOC 2 control CC7.2 requires ≥80% line coverage
coverageThreshold: { global: { lines: 80 } },
```

Severity defaults to `warn` in the `recommended` preset — the signal is advisory, not a hard stop.
