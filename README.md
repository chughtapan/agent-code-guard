# agent-code-guard

ESLint plugin that catches the patterns your coding agent must not ship.

```
npm  install --save-dev eslint-plugin-agent-code-guard
pnpm add -D eslint-plugin-agent-code-guard
```

## What it catches

Your coding agent is miscalibrated. It was trained on human-written TypeScript — decades of it — written under one constraint that does not apply to it: typing was expensive for humans. That is why its training corpus is saturated with `throw new Error("bad")`, `as Record<string, unknown>`, `try { ... } catch {}`, `Promise<T>` return types, `process.env.FOO!`, raw SQL strings, and `vi.mock` inside integration tests. Those were the compromises humans made when keyboard time was scarce. An agent does not pay the scarcity; it inherits the patterns anyway.

This plugin is the floor. The `recommended` preset bundles the agent-code-guard rules with the full SonarJS recommended set so the standard floor catches both AI miscalibration patterns and the broader bug-and-security floor SonarJS already covers (hardcoded secrets, redundant conditions, unused collections, ReDoS-prone regex, eval, etc.). The `strict` preset adds tight complexity budgets on top. An `integrationTests` preset forbids mocks in files that are supposed to be integration tests.

## Architecture guard

Beyond syntactic patterns, the plugin reasons about *project architecture*: what each file consumes and exports, what each folder consumes and exports, and what the package exposes and pulls into its runtime graph. This is the operational form of Parnas information hiding, Liskov abstraction/substitutability, and Martin package coupling metrics.

Twenty-one architecture rules ship in `recommended`, plus the always-on `architecture-directive-parse-error` that surfaces malformed suppression directives. Clear bugs with no defensible exception run as **errors**; heuristic or layered-architecture-dependent rules run as **warns** where the right call needs human judgment.

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

A standalone `architecture` preset (warn-level, all architecture diagnostics, plus directive parse errors) remains for incremental adoption when you want to step up to the architecture checks one repo at a time without flipping CI red:

```js
rules: {
  ...guard.configs.architecture.rules,
}
```

**First-run onramp.** Because the plugin ships no policy defaults, turning on the architecture preset on a real repo will fire immediately on rules that depend on policy declarations: `no-cross-domain-sibling-import` flags every cross-folder import (until you declare `sharedFolderNames`), `folder-explicit-api-required` flags every folder consumed by 2+ files (until you declare `facadeFiles` or add `index.ts`), `no-internal-subpath-export` is dormant (until you declare `forbiddenSubpathSegments`). Start by listing the obvious shared folders (`utils`, `lib`, `common`) with reasons, then walk the diagnostics and either fix or extend the lists. Each per-rule doc shows recommended starter values.

The analyzer emits package, file, folder, facade, mesh, and public-type boundary diagnostics from the same project graph; each policy has its own rule name and doc under [`docs/rules/architecture/`](docs/rules/architecture/).

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


### Architecture

| Rule | Catches |
|---|---|
| [`no-folder-cycle`](docs/rules/architecture/no-folder-cycle.md) | Strongly connected folder dependency components |
| [`no-root-internal-cycle`](docs/rules/architecture/no-root-internal-cycle.md) | Root/public files and internal files that depend on each other |
| [`no-internal-subpath-export`](docs/rules/architecture/no-internal-subpath-export.md) | `package.json` exports that expose `src/`, `internal/`, helpers, fixtures, etc. |
| [`no-public-test-helper-leak`](docs/rules/architecture/no-public-test-helper-leak.md) | `package.json` exports that expose test-only fixtures or helpers |
| [`no-export-star-boundary`](docs/rules/architecture/no-export-star-boundary.md) | `export *` declarations on public or index boundaries |
| [`no-implementation-file-public-entry`](docs/rules/architecture/no-implementation-file-public-entry.md) | Public exports that point at adapter / handler / service implementation files |
| [`no-public-vendor-type-leak`](docs/rules/architecture/no-public-vendor-type-leak.md) | Public API types that mention dependency-owned vendor types — declare via `publicTypePackages` |
| [`no-public-infra-type-leak`](docs/rules/architecture/no-public-infra-type-leak.md) | Public API types that leak infrastructure packages (Kysely, Pino, etc.) (warn) |
| [`no-inventory-barrel`](docs/rules/architecture/no-inventory-barrel.md) | `index.ts` files that re-export most of their siblings instead of curating (warn) |
| [`no-large-public-surface`](docs/rules/architecture/no-large-public-surface.md) | Public re-export fanout that exceeds the configured budget (warn) |
| [`no-upward-layer-import`](docs/rules/architecture/no-upward-layer-import.md) | Cross-layer imports that move upward when `layers` is configured (warn; dormant otherwise) |
| [`no-cross-domain-sibling-import`](docs/rules/architecture/no-cross-domain-sibling-import.md) | Sibling-domain imports that bypass the domain's public boundary (warn) |
| [`no-package-mesh`](docs/rules/architecture/no-package-mesh.md) | Folder dependency graphs whose density crosses the mesh threshold (warn) |
| [`no-large-folder`](docs/rules/architecture/no-large-folder.md) | Folders with too many direct production children, or too many children once tests are included (warn) |
| [`folder-readme-required`](docs/rules/architecture/folder-readme-required.md) | Folders with many semantic children but no boundary README (warn) |
| [`no-distant-folder-import`](docs/rules/architecture/no-distant-folder-import.md) | Local imports that reach across too many folder hops, regardless of layer declarations (warn) |
| [`require-curated-public-facade`](docs/rules/architecture/require-curated-public-facade.md) | Public facades that mirror filesystem inventory instead of curating contracts (warn) |
| [`require-boundary-owned-types`](docs/rules/architecture/require-boundary-owned-types.md) | Public boundary types that reuse imported vendor names instead of package-owned ones (warn) |
| [`folder-explicit-api-required`](docs/rules/architecture/folder-explicit-api-required.md) | Folders consumed through multiple concrete files instead of a semantic facade (warn) |
| [`file-implicit-boundary-module`](docs/rules/architecture/file-implicit-boundary-module.md) | Non-facade files acting as accidental boundaries between callers and implementation helpers (warn) |
| [`shared-kernel-cohesion`](docs/rules/architecture/shared-kernel-cohesion.md) | Shared kernels whose exports serve mostly disjoint consumer communities (warn) |
| `architecture-directive-parse-error` | Always-on. Surfaces malformed `// @agent-code-guard/architecture-exception:` directives so they cannot silently fail to suppress |

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

- `<import>.configs.recommended` — application source. Flat-config fragment with `plugins`, `settings`, and `rules`. Bundles the agent-code-guard rules with the full SonarJS recommended set (~270 SonarJS rules covering bug catches, security, regex correctness) and the architecture rules at curated severity, plus the always-on `architecture-directive-parse-error`. Excludes `no-vitest-mocks` (lives in the integration-tests preset).
- `<import>.configs.strict` — flat-config fragment with `plugins`, `settings`, and `rules`. `recommended` plus strict complexity budgets (`complexity`, `max-depth`, `max-lines`, `max-lines-per-function`, `max-statements`, cognitive complexity, nested control flow, and related limits).
- `<import>.configs.architecture.rules` — the architecture diagnostics at warn level plus `architecture-directive-parse-error` at error. Use this when stepping up to the architecture checks for the first time, before flipping CI red.
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
- **Rule namespace**: `agent-code-guard/<rule>` — same identifier as both the npm package and the companion Claude Code plugin. One name across the floor (lint) and the ceiling (write-time guidance) keeps the mental model consistent for anyone using both halves.

## Companion

**floor** — this ESLint plugin (lint-time checks). Catches patterns your agent must not ship: `throw new Error(...)`, `as Record<string, unknown>`, bare `catch {}`, etc.

**ceiling** — the [`agent-code-guard` Claude Code plugin](https://github.com/chughtapan/agent-code-guard). A Claude Code plugin is a skill that instruments the Claude Code IDE and directs the coding agent at **write-time**, before code is committed. This plugin recalibrates the agent in-band when it writes TypeScript, using the floor rules as a teaching signal.

Install both for the full calibration loop:

```
# The floor (this repo) — lint checks:
pnpm add -D eslint-plugin-agent-code-guard@latest

# The ceiling (Claude Code skills + binaries):
mkdir -p ~/.claude/skills
git clone --single-branch --depth 1 --branch main \
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

Tests live next to the code they verify. Rule-family tests are under
`src/rules/<family>/*.test.ts`, architecture analyzer tests sit inside the
architecture subfolder they exercise, and shared fixtures live under local
`test-support/` folders. `tsconfig.json` excludes `*.test.ts` and
`test-support/` from the production build, while Vitest still discovers them.

## Mutation testing

Scope: `src/**/*.ts` (every rule, utility, and the plugin entry). Run:

```
pnpm mutation
```

Stryker (with the vitest runner and typescript checker) mutates every source file and replays the vitest suite against each mutant. The default thresholds apply: **high 80, low 60, break 50**. A run that drops the overall score below 50 exits non-zero.

Mutation testing is a **required CI gate**. Every PR runs `pnpm mutation`; dropping below the break threshold fails the check. If you weaken a test, Stryker catches it before the lint rule ships.

Runs are incremental on PR and a full sweep runs nightly. Stryker persists state to `.stryker-tmp/incremental.json`, cached in CI across runs and refreshed in this repo when a release-quality mutation pass lands. Expected wall-clock varies with changed files and cache warmth: a small incremental rerun is usually a few minutes, while broad architecture changes can take **90-120 minutes** on a laptop. The 2026-05-07 whole-project incremental run landed at **85.01%** mutation score.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

MIT.
