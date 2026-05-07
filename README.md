# agent-code-guard

ESLint plugin that catches the patterns your coding agent must not ship.

```
npm  install --save-dev eslint-plugin-agent-code-guard
pnpm add -D eslint-plugin-agent-code-guard
```

## What it catches

Your coding agent is miscalibrated. It was trained on human-written TypeScript — decades of it — written under one constraint that does not apply to it: typing was expensive for humans. That is why its training corpus is saturated with `throw new Error("bad")`, `as Record<string, unknown>`, `try { ... } catch {}`, `Promise<T>` return types, `process.env.FOO!`, raw SQL strings, and `vi.mock` inside integration tests. Those were the compromises humans made when keyboard time was scarce. An agent does not pay the scarcity; it inherits the patterns anyway.

This plugin is the floor. Thirty-nine rules under the `recommended` preset (twenty-eight errors, eleven warns), plus an `integrationTests` preset that forbids mocks in the files that are supposed to be integration tests.

## Architecture guard

Beyond syntactic patterns, the plugin reasons about *project architecture*: what each file consumes and exports, what each folder consumes and exports, and what the package exposes and pulls into its runtime graph. This is the operational form of Parnas information hiding, Liskov abstraction/substitutability, and Martin package coupling metrics.

Sixteen architecture rules ship in `recommended`. Eight are **errors** — clear bugs with no defensible exception (cycles, exposed internals, uncurated public boundaries, vendor-type leaks, plus the always-on `architecture-directive-parse-error` that surfaces malformed suppression directives). Eight are **warns** — heuristic or layered-architecture-dependent rules where the right call needs human judgment.

**The plugin ships no policy defaults.** Every architectural list option (`forbiddenSubpathSegments`, `implementationPathSegments`, `sharedFolderNames`, `infrastructureTypePackages`, `allowedPublicSubpaths`, `allowedTestPublicSubpaths`, `publicTypePackages`, `layers`) defaults to `[]`. Each per-rule doc under [`docs/rules/architecture/`](docs/rules/architecture/) shows recommended starter values you can copy into your config. The act of writing those values with reasons IS the architectural decision — same principle the `{value, reason}` shape already enforces:

```js
const ARCHITECTURE_OPTIONS = {
  publicTypePackages: [
    {
      package: "@typescript-eslint/utils",
      reason: "this package is an ESLint plugin; the TSESLint rule contract is the public API",
    },
  ],
  packageRuntime: "node",
};

// then per-rule:
"agent-code-guard/no-public-vendor-type-leak": ["error", ARCHITECTURE_OPTIONS],
```

For per-file exceptions (e.g., a generated barrel that legitimately participates in a cycle), use a file-header directive instead — `eslint-disable-next-line` does not work for architecture rules because their diagnostics report at the Program node:

```ts
// @agent-code-guard/architecture-exception: no-folder-cycle
// reason: generated barrel; cycle resolved at codegen time

export * from "../app/host";
```

The `reason:` line is required. Malformed directives surface as `architecture-directive-parse-error` diagnostics so they can never silently fail to suppress.

For an explicit layered architecture (e.g., `entrypoint → app → domain → adapters → kernel`), declare the layers in your config; `no-upward-layer-import` then enforces direction:

```js
"agent-code-guard/no-upward-layer-import": ["error", {
  layers: [
    { name: "entrypoint", folders: ["."], reason: "composition root" },
    { name: "app", folders: ["app"], reason: "request orchestration" },
    { name: "domain", folders: ["domain"], reason: "business logic" },
    { name: "adapters", folders: ["adapters"], reason: "outbound implementations" },
    { name: "kernel", folders: ["shared", "ports"], reason: "domain-owned ports + shared types" },
  ],
}],
```

Without `layers` declared, `no-upward-layer-import` is dormant. See [`no-upward-layer-import.md`](docs/rules/architecture/no-upward-layer-import.md) for the full layer-direction semantics.

A standalone `architecture` preset (warn-level, all fifteen rules) remains for incremental adoption when you want to step up to the architecture checks one repo at a time without flipping CI red:

```js
rules: {
  ...guard.configs.architecture.rules,
}
```

See [`docs/architecture-boundary-ledger.md`](docs/architecture-boundary-ledger.md) for the Boundary Ledger design. The analyzer emits package, file, folder, facade, mesh, and public type boundary diagnostics from the same project graph; each policy has its own rule name and doc under [`docs/rules/architecture/`](docs/rules/architecture/).

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
| [`agent-code-guard/no-unbounded-concurrency`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/no-unbounded-concurrency.md) | `Effect.*(..., { concurrency: "unbounded" })` fan-out with no visible bound |
| [`agent-code-guard/no-process-env-at-runtime`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/no-process-env-at-runtime.md) | Runtime `process.env` access instead of reading config once at the boundary |
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
| [`agent-code-guard/no-folder-cycle`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-folder-cycle.md) | Strongly connected folder dependency components |
| [`agent-code-guard/no-root-internal-cycle`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-root-internal-cycle.md) | Root/public files and internal files that depend on each other |
| [`agent-code-guard/no-internal-subpath-export`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-internal-subpath-export.md) | `package.json` exports that expose `src/`, `internal/`, helpers, fixtures, etc. |
| [`agent-code-guard/no-public-test-helper-leak`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-public-test-helper-leak.md) | `package.json` exports that expose test-only fixtures or helpers |
| [`agent-code-guard/no-export-star-boundary`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-export-star-boundary.md) | `export *` declarations on public or index boundaries |
| [`agent-code-guard/no-implementation-file-public-entry`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-implementation-file-public-entry.md) | Public exports that point at adapter / handler / service implementation files |
| [`agent-code-guard/no-public-vendor-type-leak`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-public-vendor-type-leak.md) | Public API types that mention dependency-owned vendor types — declare via `publicTypePackages` |
| [`agent-code-guard/no-public-infra-type-leak`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-public-infra-type-leak.md) | Public API types that leak infrastructure packages (Kysely, Pino, etc.) (warn) |
| [`agent-code-guard/no-inventory-barrel`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-inventory-barrel.md) | `index.ts` files that re-export most of their siblings instead of curating (warn) |
| [`agent-code-guard/no-large-public-surface`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-large-public-surface.md) | Public re-export fanout that exceeds the configured budget (warn) |
| [`agent-code-guard/no-upward-layer-import`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-upward-layer-import.md) | Internal modules importing from root-layer or public-layer paths (warn) |
| [`agent-code-guard/no-cross-domain-sibling-import`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-cross-domain-sibling-import.md) | Sibling-domain imports that bypass the domain's public boundary (warn) |
| [`agent-code-guard/no-package-mesh`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/no-package-mesh.md) | Folder dependency graphs whose density crosses the mesh threshold (warn) |
| [`agent-code-guard/require-curated-public-facade`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/require-curated-public-facade.md) | Public facades that mirror filesystem inventory instead of curating contracts (warn) |
| [`agent-code-guard/require-boundary-owned-types`](https://github.com/chughtapan/agent-code-guard/blob/main/docs/rules/architecture/require-boundary-owned-types.md) | Public boundary types that reuse imported vendor names instead of package-owned ones (warn) |
| `agent-code-guard/architecture-directive-parse-error` | Always-on. Surfaces malformed `// @agent-code-guard/architecture-exception:` directives so they cannot silently fail to suppress |

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

- `<import>.configs.recommended.rules` — application source. All rules except `no-vitest-mocks` (the AI-pattern floor plus the architecture rules at curated severity: 8 errors, 8 warns; includes the always-on `architecture-directive-parse-error`).
- `<import>.configs.architecture.rules` — the fifteen architecture rules at warn level plus `architecture-directive-parse-error` at error. Use this when stepping up to the architecture checks for the first time, before flipping CI red.
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
- **Rule namespace**: `agent-code-guard/<rule>` — same identifier as both the npm package and the companion Claude Code plugin. One name across the floor (lint) and the ceiling (write-time guidance) keeps the mental model consistent for anyone using both halves.

## Companion

**floor** — this ESLint plugin (lint-time checks). Catches patterns your agent must not ship: `throw new Error(...)`, `as Record<string, unknown>`, bare `catch {}`, etc.

**ceiling** — the [`agent-code-guard` Claude Code plugin](https://github.com/chughtapan/agent-code-guard). A Claude Code plugin is a skill that instruments the Claude Code IDE and directs the coding agent at **write-time**, before code is committed. This plugin recalibrates the agent in-band when it writes TypeScript, using the floor rules as a teaching signal.

Install both for the full calibration loop:

```
# The floor (this repo) — lint checks:
pnpm add -D eslint-plugin-agent-code-guard@^0.0.6

# The ceiling (Claude Code skills + binaries):
mkdir -p ~/.claude/skills
git clone --single-branch --depth 1 --branch v0.0.6 \
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

Runs are incremental on PR and a full sweep runs nightly. Stryker persists state to `.stryker-tmp/incremental.json`, cached in CI across runs. Expected wall-clock varies with changed files and cache warmth: a small incremental rerun is usually a few minutes, while a broad sweep is closer to **15-30 minutes** on a laptop.

## License

MIT.
