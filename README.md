# agent-code-guard

ESLint plugin that catches the patterns your coding agent must not ship.

```
npm  install --save-dev eslint-plugin-agent-code-guard
pnpm add -D eslint-plugin-agent-code-guard
```

## What it catches

Your coding agent is miscalibrated. It was trained on human-written TypeScript — decades of it — written under one constraint that does not apply to it: typing was expensive for humans. That is why its training corpus is saturated with `throw new Error("bad")`, `as Record<string, unknown>`, `try { ... } catch {}`, `Promise<T>` return types, `process.env.FOO!`, raw SQL strings, and `vi.mock` inside integration tests. Those were the compromises humans made when keyboard time was scarce. An agent does not pay the scarcity; it inherits the patterns anyway.

This plugin is the floor. Twenty-one rules under the `recommended` preset (eighteen errors, three warns), plus an `integrationTests` preset that forbids mocks in the files that are supposed to be integration tests.

| Rule | Catches |
|---|---|
| [`agent-code-guard/async-keyword`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/async-keyword.md) | `async` functions outside Effect/Kysely patterns |
| [`agent-code-guard/as-unknown-as`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/as-unknown-as.md) | `as unknown as` cast chains that bypass type checking |
| [`agent-code-guard/promise-type`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/promise-type.md) | `Promise<T>` return types that erase the error channel |
| [`agent-code-guard/then-chain`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/then-chain.md) | `.then(...)` chains that hide error propagation |
| [`agent-code-guard/bare-catch`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/bare-catch.md) | `try { ... } catch {}` that swallows the error silently |
| [`agent-code-guard/effect-promise`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/effect-promise.md) | `Effect.promise(...)` calls that turn rejections into defects |
| [`agent-code-guard/effect-error-erasure`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/effect-error-erasure.md) | `Effect.fail(new Error(...))` and similar generic error wrapping inside the Effect channel |
| [`agent-code-guard/either-discriminant`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/either-discriminant.md) | `Either.isLeft(...)`, `Either.isRight(...)`, and `_tag === "Left" / "Right"` |
| [`agent-code-guard/manual-result`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/manual-result.md) | Reusable hand-rolled `Result` / `Either` algebras instead of `Either` / `Effect` |
| [`agent-code-guard/manual-option`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/manual-option.md) | Reusable hand-rolled `Option` / `Maybe` algebras instead of `Option` |
| [`agent-code-guard/manual-brand`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/manual-brand.md) | Hand-rolled nominal brands that should use `Brand.nominal(...)` or `Schema.brand(...)` (warn) |
| [`agent-code-guard/manual-tagged-error`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/manual-tagged-error.md) | Hand-rolled tagged error classes and error unions that should use `Data.TaggedError(...)` |
| [`agent-code-guard/record-cast`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/record-cast.md) | `as Record<string, unknown>` and similar unsafe casts |
| [`agent-code-guard/no-raw-sql`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/no-raw-sql.md) | Raw SQL strings that bypass the typed query builder |
| [`agent-code-guard/no-manual-enum-cast`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/no-manual-enum-cast.md) | `as "a" \| "b"` string-union casts that should be generated unions |
| [`agent-code-guard/no-hardcoded-secrets`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/no-hardcoded-secrets.md) | AWS/GCP/Azure keys, API tokens, passwords — see doc for patterns and entropy thresholds |
| [`agent-code-guard/no-raw-throw-new-error`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/no-raw-throw-new-error.md) | `throw new Error(...)` outside tests — return a tagged error instead |
| [`agent-code-guard/no-test-skip-only`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/no-test-skip-only.md) | `.skip` / `.only` / `xit` / `xdescribe` in committed test files |
| [`agent-code-guard/no-coverage-threshold-gate`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/no-coverage-threshold-gate.md) | `coverageThreshold` gates in jest/vitest/vite configs (warn) |
| [`agent-code-guard/no-hardcoded-assertion-literals`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/no-hardcoded-assertion-literals.md) | Hardcoded string/number literals in test assertions (warn) |
| [`agent-code-guard/tag-discriminant`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/tag-discriminant.md) | Manual `_tag` checks on tagged errors instead of `Effect.catchTag(...)` |
| [`agent-code-guard/no-vitest-mocks`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/no-vitest-mocks.md) | `vi.mock(...)` inside files that match the integration-tests glob |

Each rule ships a Before/After doc at the GitHub link above and locally at `node_modules/eslint-plugin-agent-code-guard/docs/rules/<rule-name>.md`.

## Configure

This plugin uses **ESLint flat config** (required; ESLint ≥ 9). If you have a legacy `.eslintrc`, migrate to flat config first; see [ESLint migration guide](https://eslint.org/docs/latest/use/configure/migration-guide).

**Flat config**:

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
    plugins: { "agent-code-guard": guard },
    rules: guard.configs.recommended.rules,
  },

  // Test files — only the test-hygiene rule fires here
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts", "**/tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "agent-code-guard": guard },
    rules: {
      "agent-code-guard/no-test-skip-only": "error",
      "agent-code-guard/no-hardcoded-assertion-literals": "warn",
    },
  },

  // Config files — coverage-gate lint (warn)
  {
    files: ["**/jest.config.*", "**/vitest.config.*", "**/vite.config.*"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "agent-code-guard": guard },
    rules: {
      "agent-code-guard/no-coverage-threshold-gate": "warn",
    },
  },

  // Integration tests: no mocks allowed
  {
    files: ["**/*.integration.test.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "agent-code-guard": guard },
    rules: guard.configs.integrationTests.rules,
  },
];
```

Peer dependencies: `eslint` ≥ 9, `typescript` ≥ 5.

## Presets

The import alias (e.g., `guard` in the example above) is your choice; adjust the `<import>.configs.*` path accordingly. Access presets via your import identifier:

- `<import>.configs.recommended.rules` — application source. All rules except `no-vitest-mocks`.
- `<import>.configs.integrationTests.rules` — integration-test glob only. Enforces `no-vitest-mocks` so integration tests actually hit real dependencies.

## Disabling a rule

If a rule is wrong for your codebase, disable it in flat config:

```js
rules: {
  ...guard.configs.recommended.rules,
  "agent-code-guard/async-keyword": "off",
}
```

Every disable in source should carry a written reason via `@eslint-community/eslint-plugin-eslint-comments` and the `require-description` rule. The companion Claude Code skill (see below) wires that pairing automatically.

## Name notes

- **npm package**: `eslint-plugin-agent-code-guard`.
- **Rule namespace**: `agent-code-guard/<rule>`. The namespace matches the companion Claude Code plugin (the ceiling), not the npm package (the floor). Users who install both see a consistent mental model: `agent-code-guard` is the philosophy family; `agent-code-guard` is the npm distribution of the lint half.

## Companion

**floor** — this ESLint plugin (lint-time checks). Catches patterns your agent must not ship: `throw new Error(...)`, `as Record<string, unknown>`, bare `catch {}`, etc.

**ceiling** — the [`agent-code-guard` Claude Code plugin](https://github.com/chughtapan/agent-code-guard). A Claude Code plugin is a skill that instruments the Claude Code IDE and directs the coding agent at **write-time**, before code is committed. This plugin recalibrates the agent in-band when it writes TypeScript, using the floor rules as a teaching signal.

Install both for the full calibration loop:

```
# The floor (this repo) — lint checks:
pnpm add -D eslint-plugin-agent-code-guard@^0.0.3

# The ceiling (Claude Code skills + binaries):
mkdir -p ~/.claude/skills
git clone --single-branch --depth 1 --branch v0.0.3 \
  https://github.com/chughtapan/agent-code-guard.git \
  ~/.claude/skills/agent-code-guard
cd ~/.claude/skills/agent-code-guard && pnpm install
```

**Alternatively**, invoke the `/safer:setup` skill to automate both steps on your behalf (wires floor → `eslint.config.js`, installs ceiling skill).

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
