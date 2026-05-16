# agent-code-guard

ESLint plugin that catches the patterns your coding agent must not ship.

## Install

```
npm  install --save-dev eslint-plugin-agent-code-guard
pnpm add -D eslint-plugin-agent-code-guard
```

## Hello world

Drop this into `eslint.config.js`:

```js
import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tsParser },
    ...guard.configs.recommended,
  },
];
```

Then run `eslint .` against any TypeScript file and the agent-code-guard syntax floor lights up. `@typescript-eslint/parser` is the only peer the syntax floor needs.

## What it catches

Your coding agent is miscalibrated. It was trained on human-written TypeScript — decades of it — written under one constraint that does not apply to it: typing was expensive for humans. That is why its training corpus is saturated with `throw new Error("bad")`, `as Record<string, unknown>`, `try { ... } catch {}`, `Promise<T>` return types, `process.env.FOO!`, raw SQL strings, and `vi.mock` inside integration tests. Those were the compromises humans made when keyboard time was scarce. An agent does not pay the scarcity; it inherits the patterns anyway.

This plugin is the floor. The `recommended` preset bundles the agent-code-guard rules with the full SonarJS recommended set so the standard floor catches both AI miscalibration patterns and the broader bug-and-security floor SonarJS already covers (hardcoded secrets, redundant conditions, unused collections, ReDoS-prone regex, eval, etc.). The `strict` preset adds tight complexity budgets on top. An `integrationTests` preset forbids mocks in files that are supposed to be integration tests.

### Async flow

| Rule | Catches |
|---|---|
| [`async-keyword`](docs/rules/async-flow/async-keyword.md) | `async` functions outside Effect/Kysely patterns |
| [`promise-type`](docs/rules/async-flow/promise-type.md) | `Promise<T>` return types that erase the error channel |
| [`then-chain`](docs/rules/async-flow/then-chain.md) | `.then(...)` chains that hide error propagation |
| [`bare-catch`](docs/rules/async-flow/bare-catch.md) | `try { ... } catch {}` that swallows the error silently |
| [`no-conditional-chaining`](docs/rules/async-flow/no-conditional-chaining.md) | Optional/nullish parameters accepted outside explicit parser/normalizer boundaries (warn) |
| [`no-unbounded-concurrency`](docs/rules/async-flow/no-unbounded-concurrency.md) | `Effect.*(..., { concurrency: "unbounded" })` fan-out with no visible bound |

### Effect

| Rule | Catches |
|---|---|
| [`effect-promise`](docs/rules/effect/effect-promise.md) | `Effect.promise(...)` calls that turn rejections into defects |
| [`effect-error-erasure`](docs/rules/effect/effect-error-erasure.md) | `Effect.fail(new Error(...))` and similar generic error wrapping inside the Effect channel |
| [`either-discriminant`](docs/rules/effect/either-discriminant.md) | `Either.isLeft(...)`, `Either.isRight(...)`, and `_tag === "Left" / "Right"` |
| [`tag-discriminant`](docs/rules/effect/tag-discriminant.md) | Manual `_tag` checks on Effect-flavored tagged unions (`Effect`, `Either`, `Option`, `Cause`, `Exit`, `Data.TaggedError`, …); type-aware, needs `parserOptions.project` |
| [`no-effect-error-coalescing`](docs/rules/effect/no-effect-error-coalescing.md) | `Effect.mapError` / `catchAll` wrappers that collapse typed error variants into one broad error (warn) |

### Manual algebra

| Rule | Catches |
|---|---|
| [`manual-result`](docs/rules/manual-algebra/manual-result.md) | Reusable hand-rolled `Result` / `Either` algebras instead of `Either` / `Effect` |
| [`manual-option`](docs/rules/manual-algebra/manual-option.md) | Reusable hand-rolled `Option` / `Maybe` algebras instead of `Option` |
| [`manual-tagged-error`](docs/rules/manual-algebra/manual-tagged-error.md) | Hand-rolled tagged error classes and error unions that should use `Data.TaggedError(...)` |
| [`manual-brand`](docs/rules/manual-algebra/manual-brand.md) | Hand-rolled nominal brands that should use `Brand.nominal(...)` or `Schema.brand(...)` (warn) |
| [`no-manual-brand-constructor`](docs/rules/manual-algebra/no-manual-brand-constructor.md) | Cast helpers such as `asUserId` / `makeUserId` that manually construct branded values (warn) |
| [`no-exported-brand-constructor`](docs/rules/manual-algebra/no-exported-brand-constructor.md) | Exported brand or schema constructors instead of local constructors plus exported boundary functions/types (warn) |
| [`no-manual-enum-cast`](docs/rules/manual-algebra/no-manual-enum-cast.md) | `as "a" \| "b"` string-union casts that should be generated unions |

### Safety

| Rule | Catches |
|---|---|
| [`as-unknown-as`](docs/rules/safety/as-unknown-as.md) | `as unknown as` cast chains that bypass type checking |
| [`record-cast`](docs/rules/safety/record-cast.md) | `as Record<string, unknown>` and similar unsafe casts |
| [`no-process-env-at-runtime`](docs/rules/safety/no-process-env-at-runtime.md) | Runtime `process.env` access instead of reading config once at the boundary |
| [`no-raw-sql`](docs/rules/safety/no-raw-sql.md) | Raw SQL strings that bypass the typed query builder |
| [`no-raw-throw-new-error`](docs/rules/safety/no-raw-throw-new-error.md) | `throw new Error(...)` outside tests — return a tagged error instead |
| [`max-non-trivial-classes-per-file`](docs/rules/safety/max-non-trivial-classes-per-file.md) | More than one logic-bearing class per file; classes that extend a configured tag-class factory (default: `Data.TaggedError`, `Context.Tag`, `Effect.Service`, …) are exempt regardless of body |

### Testing

| Rule | Catches |
|---|---|
| [`no-test-skip-only`](docs/rules/testing/no-test-skip-only.md) | `.skip` / `.only` / `xit` / `xdescribe` in committed test files |
| [`no-example-only-tests`](docs/rules/testing/no-example-only-tests.md) | Test scopes with multiple examples but no property/generative invariant test (warn) |
| [`no-coverage-threshold-gate`](docs/rules/testing/no-coverage-threshold-gate.md) | `coverageThreshold` gates in jest/vitest/vite configs (warn) |
| [`no-hardcoded-assertion-literals`](docs/rules/testing/no-hardcoded-assertion-literals.md) | Hardcoded string/number literals in test assertions (warn) |
| [`no-vitest-mocks`](docs/rules/testing/no-vitest-mocks.md) | `vi.mock(...)` inside files that match the integration-tests glob |

### Tooling

| Rule | Catches |
|---|---|
| [`require-knip-in-lint`](docs/rules/tooling/require-knip-in-lint.md) | `package.json` default quality scripts that omit Knip |

### Documentation

JSDoc lint comes from bundled [`eslint-plugin-jsdoc`](https://github.com/gajus/eslint-plugin-jsdoc); consumers do not install it separately. `recommended` and `strict` turn on the logical and contents rule sets — these validate JSDoc *content* (`check-types`, `valid-types`, `no-types`, `informative-docs`, etc.) and only fire if JSDoc is present and broken. `strict` additionally enables the stylistic rules. `jsdoc/no-undefined-types` is dropped because TypeScript resolves type names; pairing it with `no-types: error` would emit duplicate diagnostics on every `@param {T}` line.

A separate `documentation` preset enforces that JSDoc must exist on every exported declaration — every interface, type alias, enum, function, class, and exported `const` needs a doc comment, with `@param`, `@property`, and `@returns` all filled in. Because forcing JSDoc on every internal helper is noise, this preset is meant to be scoped to your folder barrels:

```js
{
  files: ["src/**/index.ts", "src/index.ts"],
  plugins: guard.configs.documentation.plugins,
  rules: guard.configs.documentation.rules,
}
```

That keeps the public boundary fully documented while leaving file-internal code free to skip JSDoc.

Rule IDs in your config are namespaced as `agent-code-guard/<rule>`. Each rule ships a Before/After doc at the link above and locally at `node_modules/eslint-plugin-agent-code-guard/docs/rules/<family>/<rule-name>.md`.

## Configure

This plugin uses **ESLint flat config** (required; ESLint ≥ 9). If you have a legacy `.eslintrc`, migrate to flat config first; see [ESLint migration guide](https://eslint.org/docs/latest/use/configure/migration-guide).

**Flat config**:

```js
// eslint.config.js
import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  // Application source - prod rules, SonarJS, and strict complexity budgets
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: guard.configs.strict.plugins,
    settings: guard.configs.strict.settings,
    rules: guard.configs.strict.rules,
  },

  // Test files - same complexity bar, with test-specific guard rules
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts", "**/tests/**/*.ts", "**/test-support/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: guard.configs.strict.plugins,
    settings: guard.configs.strict.settings,
    rules: {
      ...guard.configs.strict.rules,
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

Peer dependencies: `eslint` ≥ 9, `typescript` ≥ 5. SonarJS and `eslint-plugin-jsdoc` are runtime dependencies of this package, so users of `guard.configs.recommended` / `strict` / `documentation` do not install them separately. Knip is also bundled and exposed as the `agent-code-guard-knip` bin, so downstream repos can put `agent-code-guard-knip` (or plain `knip` if they have it installed directly) in their lint scripts and the `require-knip-in-lint` rule will accept either.

## Presets

The import alias (e.g., `guard` in the example above) is your choice; adjust the `<import>.configs.*` path accordingly. Access presets via your import identifier:

- `<import>.configs.recommended` — application source. Flat-config fragment with `plugins`, `settings`, and `rules`. Bundles the agent-code-guard rules with the full SonarJS recommended set (~270 SonarJS rules covering bug catches, security, regex correctness). Excludes `no-vitest-mocks` (lives in the integration-tests preset).
- `<import>.configs.strict` — flat-config fragment with `plugins`, `settings`, and `rules`. `recommended` plus strict complexity budgets (`complexity`, `max-depth`, `max-lines`, `max-lines-per-function`, `max-statements`, cognitive complexity, nested control flow, and related limits).
- `<import>.configs.integrationTests.rules` — integration-test glob only. Enforces `no-vitest-mocks` so integration tests actually hit real dependencies.
- `<import>.configs.documentation` — barrel files only. Flat-config fragment with `plugins` and `rules`. Enforces `jsdoc/require-jsdoc` plus the full `require-*` family (param descriptions, property descriptions, returns) on every exported declaration. Apply to `**/index.ts`.

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
- **Rule namespace**: `agent-code-guard/<rule>` — used by both this package and the LSP servers safer-by-default declares (`agent-code-guard-syntax`, `agent-code-guard-architecture`). One namespace across the floor (lint), the editor (LSP), and the agent loop keeps the mental model consistent.

## Companion

**floor** — this ESLint plugin (lint-time checks). Catches per-file patterns your agent must not ship: `throw new Error(...)`, `as Record<string, unknown>`, bare `catch {}`, etc. Every rule's `meta.docs.url` points at the corresponding heading in [`safer-by-default/PRINCIPLES.md`](https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md), so any ESLint LSP renders a `codeDescription.href` link straight from each diagnostic to the underlying doctrine.

**ceiling** — [`safer-by-default`](https://github.com/chughtapan/safer-by-default), a Claude Code skill plugin. It calibrates the coding agent at **write-time** before code is committed, and its `.claude-plugin/plugin.json` declares two `lspServers` that auto-start when an LSP-aware editor (or the Claude Code agent loop) opens a TypeScript file:

- `agent-code-guard-syntax` — wraps upstream `vscode-eslint-language-server` to surface every rule from this plugin with its rationale + PRINCIPLES.md link.
- `agent-code-guard-architecture` — runs a custom architecture analyzer (folder graph, public surface, vendor type leaks, cycle detection). Architecture rules used to live in this repo; they moved to safer-by-default to keep the npm package pure-syntax. See safer-by-default's [`ARCHITECTURE.md`](https://github.com/chughtapan/safer-by-default/blob/main/ARCHITECTURE.md) → LSP integration.

Install both for the full calibration loop:

```bash
# The floor (this repo) — lint checks via npm:
pnpm add -D eslint-plugin-agent-code-guard@latest

# The ceiling (Claude Code skill plugin + LSPs) — via Claude Code:
# In a Claude Code session:
/plugin marketplace add chughtapan/safer-by-default
/plugin install safer@safer-by-default
```

**Alternatively**, invoke `/safer:setup` in any TypeScript repo to automate both steps (wires this floor into `eslint.config.js`, flips tsconfig strict flags, installs the integration-tests preset, and the two LSPs auto-register from the Claude plugin).

## Development

```
pnpm install
pnpm build
pnpm test
```

Tests live next to the code they verify. Rule-family tests are under
`src/rules/<family>/*.test.ts`, and shared fixtures live under local
`test-support/` folders. `tsconfig.json` excludes `*.test.ts` and
`test-support/` from the production build, while Vitest still discovers them.

## Mutation testing

Scope: `src/**/*.ts` (every rule, utility, and the plugin entry). Run:

```
pnpm mutation
```

Stryker (with the vitest runner and typescript checker) mutates every source file and replays the vitest suite against each mutant. The default thresholds apply: **high 80, low 60, break 50**. A run that drops the overall score below 50 exits non-zero.

Mutation testing is a **required CI gate**. Every PR runs `pnpm mutation`; dropping below the break threshold fails the check. If you weaken a test, Stryker catches it before the lint rule ships.

Runs are incremental on PR and a full sweep runs nightly. Stryker persists state to `.stryker-tmp/incremental.json`, cached in CI across runs and refreshed in this repo when a release-quality mutation pass lands.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

MIT.
