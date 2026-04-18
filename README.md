# agent-code-guard

ESLint plugin that catches the patterns your coding agent must not ship.

```
npm  install --save-dev eslint-plugin-agent-code-guard
pnpm add -D eslint-plugin-agent-code-guard
```

## What it catches

Your coding agent is miscalibrated. It was trained on human-written TypeScript — decades of it — written under one constraint that does not apply to it: typing was expensive for humans. That is why its training corpus is saturated with `throw new Error("bad")`, `as Record<string, unknown>`, `try { ... } catch {}`, `Promise<T>` return types, `process.env.FOO!`, raw SQL strings, and `vi.mock` inside integration tests. Those were the compromises humans made when keyboard time was scarce. An agent does not pay the scarcity; it inherits the patterns anyway.

This plugin is the floor. Twelve rules under the `recommended` preset (eleven errors, one warn), plus an `integrationTests` preset that forbids mocks in the files that are supposed to be integration tests.

| Rule | Catches |
|---|---|
| `safer-by-default/async-keyword` | `async` functions outside Effect/Kysely patterns |
| `safer-by-default/promise-type` | `Promise<T>` return types that erase the error channel |
| `safer-by-default/then-chain` | `.then(...)` chains that hide error propagation |
| `safer-by-default/bare-catch` | `try { ... } catch {}` that swallows the error silently |
| `safer-by-default/record-cast` | `as Record<string, unknown>` and similar unsafe casts |
| `safer-by-default/no-raw-sql` | Raw SQL strings that bypass the typed query builder |
| `safer-by-default/no-manual-enum-cast` | `as "a" \| "b"` string-union casts that should be generated unions |
| `safer-by-default/no-hardcoded-secrets` | Literal secret-shaped values in source |
| `safer-by-default/no-raw-throw-new-error` | `throw new Error(...)` outside tests — return a tagged error instead |
| `safer-by-default/no-test-skip-only` | `.skip` / `.only` / `xit` / `xdescribe` in committed test files |
| `safer-by-default/no-coverage-threshold-gate` | `coverageThreshold` gates in jest/vitest/vite configs (warn) |
| `safer-by-default/no-vitest-mocks` | `vi.mock(...)` inside files that match the integration-tests glob |

Each rule ships a Before/After doc at `node_modules/eslint-plugin-agent-code-guard/docs/rules/<rule-name>.md`.

## Configure

Flat config (ESLint ≥ 9):

```js
// eslint.config.js
import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  // Application source — prod rules, test files excluded
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "safer-by-default": guard },
    rules: guard.configs.recommended.rules,
  },

  // Test files — only the test-hygiene rule fires here
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts", "**/tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "safer-by-default": guard },
    rules: {
      "safer-by-default/no-test-skip-only": "error",
    },
  },

  // Config files — coverage-gate lint (warn)
  {
    files: ["**/jest.config.*", "**/vitest.config.*", "**/vite.config.*"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "safer-by-default": guard },
    rules: {
      "safer-by-default/no-coverage-threshold-gate": "warn",
    },
  },

  // Integration tests: no mocks allowed
  {
    files: ["**/*.integration.test.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "safer-by-default": guard },
    rules: guard.configs.integrationTests.rules,
  },
];
```

Peer dependencies: `eslint` ≥ 9, `typescript` ≥ 5.

## Presets

- `guard.configs.recommended.rules` — application source. All rules except `no-vitest-mocks`.
- `guard.configs.integrationTests.rules` — integration-test glob only. Enforces `no-vitest-mocks` so integration tests actually hit real dependencies.

## Disabling a rule

If a rule is wrong for your codebase, disable it in flat config:

```js
rules: {
  ...guard.configs.recommended.rules,
  "safer-by-default/async-keyword": "off",
}
```

Every disable in source should carry a written reason via `@eslint-community/eslint-plugin-eslint-comments` and the `require-description` rule. The companion Claude Code skill (see below) wires that pairing automatically.

## Name notes

- **npm package**: `eslint-plugin-agent-code-guard`.
- **Rule namespace**: `safer-by-default/<rule>`. The namespace matches the companion Claude Code plugin (the ceiling), not the npm package (the floor). Users who install both see a consistent mental model: `safer-by-default` is the philosophy family; `agent-code-guard` is the npm distribution of the lint half.

## Companion

This plugin is the floor — the patterns an agent must not ship. The ceiling is the [`safer-by-default` Claude Code plugin](https://github.com/chughtapan/safer-by-default), which recalibrates the agent in-band when it writes TypeScript. Install both:

```
# The floor (this repo):
pnpm add -D eslint-plugin-agent-code-guard

# The ceiling (skills + binaries):
git clone --single-branch --depth 1 \
  https://github.com/chughtapan/safer-by-default.git \
  ~/.claude/skills/safer-by-default
cd ~/.claude/skills/safer-by-default && ./setup
```

The skills plugin ships a `/safer:setup` skill that installs this lint plugin and wires it into `eslint.config.js` on your behalf.

## Development

```
pnpm install
pnpm build
pnpm test
```

Each rule has an independent test file under `tests/`. The test harness uses `@typescript-eslint/rule-tester`.

## Mutation testing

Scope: `src/**/*.ts` (every rule, utility, and the plugin entry). Run:

```
pnpm mutation
```

Stryker (with the vitest runner and typescript checker) mutates every source file and replays the vitest suite against each mutant. The default thresholds apply: **high 80, low 60, break 50**. A run that drops the overall score below 50 exits non-zero.

Mutation testing is a **required CI gate**. Every PR runs `pnpm mutation`; dropping below the break threshold fails the check. If you weaken a test, Stryker catches it before the lint rule ships.

Runs are incremental on PR and a full sweep runs nightly. Stryker persists state to `.stryker-tmp/incremental.json`, cached in CI across runs. Expected wall-clock: **under 2 minutes** for a typical PR (changed files only), **under 10 minutes** for a full sweep when the cache is cold.

## License

MIT.
