# Changelog

## [0.0.11] - 2026-05-08

### Removed

- **`sonarjs/max-lines` no longer in `recommended` or `strict`.** It was
  a near-duplicate of ESLint's built-in `max-lines`, which already runs
  in both presets and supports `skipBlankLines` / `skipComments`.
  Two rules reporting the same finding with slightly different line
  counts is noise. Consumers who want the SonarJS variant can re-enable
  it explicitly. The other SonarJS complexity rules
  (`sonarjs/cognitive-complexity`, `sonarjs/cyclomatic-complexity`,
  `sonarjs/max-lines-per-function`) stay — they each measure something
  the ESLint built-ins don't, or count it differently enough to be
  worth keeping.

## [0.0.10] - 2026-05-08

### Fixed

- **v0.0.9 was unusable for consumers.** The published `dist/` shipped
  `rules/utils/typed-linter/rule-tester.js`, which imports
  `@typescript-eslint/rule-tester` (a devDependency, not a runtime
  dependency). Any consumer that ran ESLint with the plugin loaded
  saw `ERR_MODULE_NOT_FOUND: Cannot find package
  '@typescript-eslint/rule-tester'`.
  Move `rule-tester.ts` into
  `src/rules/utils/typed-linter/test-support/`, which is excluded
  from the build. The barrel `typed-linter/index.ts` now exports
  only `requireServices`. `createTypedRuleTester` stays available to
  this plugin's own tests via the test-support path; consumers never
  see it.
- **Inline rule option types.** Replace the named `Options`
  interfaces in `no-raw-sql` and `prefer-effect-platform` with type
  aliases inlined into the `createRule` generic. tsc still emits a
  clean `.d.ts` (no TS4023) and knip no longer flags an unused
  exported interface.

## [0.0.9] - 2026-05-07

### Added — Effect runtime rules

- **`no-console-in-effect`** (error) — flags `console.log/error/warn/info/debug/trace` calls in files that import from `"effect"` or `"@effect/*"`. Use `Effect.log` / `Effect.logDebug` / `Effect.logError` instead. CLI roots (`cli/`, `bin/`, `cli.ts`) auto-excluded.
- **`no-promise-all-in-effect`** (error) — flags `Promise.all` / `allSettled` / `race` / `any` in files that import Effect. Use `Effect.all` / `Effect.forEach` with explicit concurrency.
- **`prefer-effect-platform`** (error) — single rule with options table. In Effect files, flags raw `fs` / `node:fs` / `http` / `node:http` imports, `process.argv`, bare `fetch()`, raw SQL drivers (`pg`, `mysql2`, `kysely`, `drizzle-orm`, `better-sqlite3`), and CLI libs (`yargs`, `commander`). Per-target opt-out via `{ disable: ["fs", "http", "argv", "fetch", "sql", "cli"] }`.
- **`effect-foreach-requires-concurrency`** (warn) — flags `Effect.forEach` calls without an explicit `concurrency` option. Default sequential is rarely the right answer for I/O work and the silent default obscures the policy.

### Added — Effect logging & observability rules

- **`require-span-on-exported-effect`** (warn) — flags exported `Effect.gen`-bearing values whose subtree never references `withSpan`. Trace boundaries belong on exported Effect surfaces.
- **`handler-requires-span`** (warn) — flags `Effect.gen` bodies in handler/route files (under `handlers/`, `routes/`, or named `*-handler.*` / `*.route.*`) without `withSpan`.
- **`annotate-without-span`** (warn) — flags `Effect.annotateCurrentSpan` calls in files with no `withSpan` reference. Without an enclosing span the annotation silently no-ops.
- **`logger-config-at-boot`** (warn) — flags `Logger.withMinimumLogLevel` / `withConsoleLog` / `withConsoleError` calls outside boot files (entry points, bootstrap, `*.config.*`). Logger config is process-wide.
- **`prefer-annotate-logs`** (warn) — flags `Effect.log*` calls whose second argument is an inline object literal. Use `Effect.annotateLogs({...})` once on the surrounding Effect.

### Added — Effect scope & resource rules

- **`runpromise-requires-scoped`** (error, **typed**) — flags `Effect.runPromise` / `runPromiseExit` / `runSync` / `runSyncExit` whose input Effect's `R` parameter contains `Scope`. Catches "ran but never released." First typed rule in the plugin; gracefully skips files without `parserOptions.project`.
- **`fork-requires-lifecycle`** (warn) — flags `Effect.fork(...)` whose Fiber is structurally discarded (statement context, unassigned `yield*`, unassigned `await`). Suggest capturing the Fiber, or using `Effect.forkScoped` / `Effect.forkDaemon`.
- **`acquire-release-requires-scope`** (warn) — flags `Effect.acquireRelease` / `acquireUseRelease` in files with no `Effect.scoped` / `Layer.scoped` reference. The Scope requirement never gets satisfied.
- **`finalizer-requires-scope`** (warn) — flags `Scope.addFinalizer` calls in files with no scoped frame. Without a Scope, the finalizer never runs.

### Added — Effect schema rules

- **`no-schema-type-cast`** (error) — flags bare casts to `Schema.Schema.Type<typeof S>`, `Schema.Schema.Encoded`, `Schema.Type`, `Schema.Encoded`. Decode through the schema instead of asserting.
- **`prefer-decode-effect-at-boundary`** (warn) — flags `Schema.decodeUnknownSync` / `decodeSync` / `decodeUnknownEither` over `JSON.parse(...)` or `fs.read*` / `fetch` results. Use the Effect-returning decoder so failures stay typed.
- **`parse-into-schema-requires-effect`** (warn) — flags `Schema.decode*(JSON.parse(x))` chains outside an `Effect.try` thunk. `JSON.parse` can throw outside the Effect channel even when the decoder doesn't.

### Added — Effect config rule

- **`prefer-config-redacted`** (warn) — flags `Config.string("name")` calls where `name` matches the secret regex (`api_key`, `secret`, `token`, `password`, `credential`, `private_key`, `bearer`, `access_key`). Use `Config.redacted` so the value renders as `<redacted>` in logs / `JSON.stringify` / stack traces.

### Added — safety rule

- **`no-env-nonnull-assert`** (error) — flags non-null assertions on `process.env.X` reads (`process.env.PORT!`). The bang silences TypeScript without validating the value at runtime; validate or default the read at the boundary instead. Pairs with `no-process-env-at-runtime`.

### Added — architecture rules

- **`no-trivial-sink-file`** (warn) — flags non-test, non-index, non-public files with exactly **one consumer** and a trivial surface (≤2 exports, ≤5 top-level statements) whose sole consumer **uses** the symbols (not just re-exports them). Inline at the call site. Exception: barrel re-export consumers — those count as the public API, not as the sole consumer.
- **`no-fat-orchestrator`** (warn) — flags non-entry-point files with fan-out ≥ 15, fan-in ≤ 1, and ≥ 20 top-level statements. Entry points (index/main/cli, public surface, files under `cli/`/`bin/`, `*.config.*`) are exempt. Calibrated against ESLint's `lib/linter/linter.js` (27 imports, 36 top-level statements).

### Added — typed-linter infrastructure

- **`tsconfig.test.json`** + `src/utils/parser-services.ts` (`requireServices(context)`) + `src/utils/typed-rule-tester.ts` (`createTypedRuleTester()`) + `src/utils/test-support/typed-fixture.ts`. Enables type-aware rules that gracefully skip when `parserOptions.project` is not set, so consumers without typed-linter setup are not broken.
- **`SourceModule.topLevelStatementCount`** field added to the architecture analyzer's project graph (excludes import declarations). Powers `no-trivial-sink-file` and `no-fat-orchestrator`.

### Changed

- **`no-raw-sql`** message is now tool-neutral. Default reads `Raw SQL in .query(); use a typed SQL boundary` (was: "use a query builder (e.g. Kysely)"). New `{ recommend?: string }` option lets consumers name a tool: `["error", { recommend: "@effect/sql" }]` produces `Raw SQL in .query(); use @effect/sql or another typed SQL boundary`. Doc reframed to list Kysely, Drizzle, and `@effect/sql` as examples of typed SQL boundaries, not as "the" recommendation.
- **Architecture rule registry split.** Recommended/preset entries moved from `plugin-rules.ts` to `plugin-presets.ts` to keep both files under the SonarJS max-lines floor.
- **`src/rules/effect/` split into sub-families.** The 17 new Effect rules grouped into `effect/observability/` (6), `effect/scope/` (4), `effect/schema/` (3), `effect/runtime/` (4); the original 5 (effect-error-erasure, effect-promise, either-discriminant, no-effect-error-coalescing, tag-discriminant) stay at the top level. Rule IDs and the public plugin entrypoint are unchanged. Doc layout is unchanged (`docs/rules/effect/` stays flat).

## [0.0.8] - 2026-05-07

### Added — syntax rules

- **`no-conditional-chaining`** (warn) — flags functions that forward an
  optional or nullable parameter to another call without a prior
  early-return guard, default coalesce, or local shadow. Resolve the
  uncertainty at the boundary; let the rest of the call graph receive a
  concrete value. Functions named like parser/normalizer boundaries
  (`parse*`, `decode*`, `normalize*`, `resolve*`, `read*`, `from*`) are
  exempt.
- **`no-effect-error-coalescing`** (warn) — flags `Effect.mapError` /
  `catchAll` / `catchAllCause` callbacks that collapse typed error variants
  into one broad wrapper. Preserve the typed error union or handle each tag
  explicitly.
- **`no-example-only-tests`** (warn) — flags test scopes that accumulate
  example cases without a property/generative invariant. Examples are
  regression anchors; without an invariant they don't state what the suite
  actually proves.
- **`no-exported-brand-constructor`** (warn) — flags exported brand and
  schema constructors (`Brand.nominal`, Effect `Schema.*`, Zod `z.*`,
  TypeBox `Type.*`). Keep constructors local; export derived types and
  boundary functions.
- **`no-manual-brand-constructor`** (warn) — flags reusable cast helpers
  like `asUserId` / `makeUserId` that brand by casting. Brand at a boundary
  (parser, decoder, `Brand.nominal`, `Schema.brand`).
- **`require-knip-in-lint`** (error) — flags `package.json` default lint
  scripts that omit Knip. Dead-code detection only works when it stays in
  the routine path. The plugin re-exposes a bundled
  `agent-code-guard-knip` bin so downstream repos can put Knip in default
  lint scripts without a direct install.

### Added — architecture rules

- **`no-large-folder`** (warn) — flags folders with too many direct
  production children, or too many children once tests are included.
  Defaults: 10 production / 20 including tests / 20 unpaired tests.
- **`folder-readme-required`** (warn) — flags folders with at least N
  semantic children and no README. Default threshold: 4 children.
- **`no-distant-folder-import`** (warn) — flags imports that reach across
  too many folder hops, regardless of layer declarations. Layer rules catch
  direction; this catches reach. Default: 4 hops.
- **`folder-explicit-api-required`** (warn) — flags folders consumed by
  outside code through 2+ concrete files instead of a semantic facade
  (index.ts or declared `facadeFiles`).
- **`file-implicit-boundary-module`** (warn) — flags non-facade files that
  behave like accidental boundaries: 2+ production incoming, 2+ outgoing
  implementation, 2+ exported names.
- **`shared-kernel-cohesion`** (warn) — flags shared helpers whose exports
  serve mostly disjoint consumer communities (median pairwise overlap
  below 0.25). Sample-size guards default to 6+ exports and 4+ consumers.

### Changed

- **The `recommended` preset now folds in the SonarJS recommended
  set.** Every consumer of `recommended` gets the full SonarJS floor
  (bug catches: `no-identical-conditions`, `no-empty-collection`,
  `no-extra-arguments`, `no-useless-catch`; security:
  `no-hardcoded-secrets`, `no-hardcoded-passwords`, `no-hardcoded-ip`,
  `code-eval`, `sql-queries`; regex correctness: `no-invalid-regexp`,
  `slow-regex`, `no-misleading-character-class`, ~50 more) plus the
  agent-code-guard rules. `strict` is now `recommended` plus the strict
  complexity budgets. SonarJS is a runtime dependency.
- **Source layout: rules grouped by family.** `src/rules/<rule>.ts` is now
  `src/rules/<family>/<rule>.ts` under `async-flow/`, `effect/`,
  `manual-algebra/`, `safety/`, `testing/`, and `tooling/`. The architecture
  analyzer continues to live under `src/rules/architecture/`. Each family
  has a README naming what belongs there. The plugin entrypoint and rule
  IDs are unchanged.
- **Doc layout mirrors the source family folders.** Per-rule docs moved
  from `docs/rules/<rule>.md` to `docs/rules/<family>/<rule>.md`.
  Architecture docs already lived under `docs/rules/architecture/` and stay
  there.
- Architecture analyzer fixes: 5s TTL on the report cache so long-lived
  ESLint LSP processes don't show stale warnings until restart;
  per-file memoization for nearest-package-root walks; relaxed the
  100% facade-consumer requirement in `folder-explicit-api-required`
  to 80%.

### Removed

- **`agent-code-guard/no-hardcoded-secrets`** — removed. Replaced by
  `sonarjs/no-hardcoded-secrets` (S6418), which has a larger maintained
  pattern set covering AWS, GCP, Azure, JWT, and generic high-entropy
  strings. The rule is in the `recommended` preset.
- **`docs/architecture-boundary-ledger.md`** — the design doctrine doc was
  retired. The per-rule docs name the design principle each diagnostic
  enforces; the ledger had become redundant narrative.
- The unscoped `knip` bin alias was dropped from `package.json` to
  avoid colliding with downstream Knip direct installs in
  `node_modules/.bin/`. `agent-code-guard-knip` remains.

## [0.0.7] - 2026-05-07

### Added

- **Explicit `layers` option** for `no-upward-layer-import`. Declare your
  architecture as an ordered array of layers (entrypoint → app → domain →
  adapters → kernel, etc.); each layer lists its folder paths and a
  written reason. Layer N may import from any folder in layer N+1, N+2,
  ... (downward, including skipping layers); upward imports flag with
  layer names in the diagnostic message. Folder match uses
  longest-prefix; ties resolve to the lower layer index. Within-layer
  cycles still get caught by `no-folder-cycle`.
- When `layers` are declared and both endpoints of an import land in
  layered folders, `no-cross-domain-sibling-import` defers to the layers
  system entirely. Layers express direction across folders; the sibling
  rule is a fallback for the no-layer case.

### Changed (BREAKING)

- **All architectural list options now default to `[]`.** The plugin no
  longer ships hardcoded opinions. Every architectural policy
  (`forbiddenSubpathSegments`, `implementationPathSegments`,
  `sharedFolderNames`, `infrastructureTypePackages`,
  `allowedPublicSubpaths`, `allowedTestPublicSubpaths`,
  `publicTypePackages`) defaults to an empty array; the user declares
  exactly the values that fit their repo, each with a written reason.
  Each per-rule doc under [`docs/rules/architecture/`](docs/rules/architecture/)
  shows recommended starter values to copy in.
- **Removed the depth-based heuristic in `no-upward-layer-import`.** The
  rule used to use folder-path nesting (child imports parent index) as a
  proxy for layering. It now ONLY fires when `layers` is configured. With
  no layers declared, the rule is dormant. Users who relied on the
  heuristic see fewer diagnostics until they declare their layers.
- **Source layout: the architecture analyzer moved from
  `src/architecture/` to `src/rules/architecture/`.** The analyzer is
  consumed only by the architecture-rule factory; placing it under
  `src/rules/` reflects ownership and removes the cross-domain-sibling
  flag the previous layout produced.

### Fixed

- Architecture test-file classification now treats `test-support/` as
  test-only infrastructure alongside `test-utils/`, fixtures, and
  `__tests__/` folders.

### Testing

- Added property-based coverage for architecture graph behavior:
  source/output specifier resolution, folder SCCs and edge density,
  export declaration classification, public API fallback selection,
  option-schema numeric bounds, and layer-prefix boundary matching.
- Refreshed the checked-in Stryker incremental summary after a
  whole-project run: **85.01%** mutation score, 1,651 killed mutants,
  229 survived mutants, 11 timeouts, and 64 no-coverage mutants.

## [0.0.6] - 2026-05-06

### Added

- Fifteen architecture rules — analyzer reasons about file/folder/package boundaries:
  - **Cycles:** `no-folder-cycle`, `no-root-internal-cycle`
  - **Public package surface:** `no-internal-subpath-export`, `no-public-test-helper-leak`,
    `no-export-star-boundary`, `no-implementation-file-public-entry`,
    `no-large-public-surface`, `require-curated-public-facade`
  - **Type leaks:** `no-public-vendor-type-leak`, `no-public-infra-type-leak`,
    `require-boundary-owned-types`
  - **Layered/domain hygiene:** `no-cross-domain-sibling-import`, `no-upward-layer-import`,
    `no-package-mesh`, `no-inventory-barrel`
- Per-rule docs under [`docs/rules/architecture/`](docs/rules/architecture/).
- Tag-driven npm publish workflow (`.github/workflows/publish.yml`).
- **File-header directive suppression** — `// @agent-code-guard/architecture-exception: <rule-id>`
  followed by a `// reason: <text>` line at the top of a source file suppresses
  that rule for the file. ESLint's per-line `eslint-disable-next-line` does
  not work for architecture rules (their diagnostics report at the Program
  node), so the directive is the right tool. The reason field is required;
  malformed directives surface as `architecture-directive-parse-error`
  diagnostics instead of silently failing to suppress.
- New always-on rule **`architecture-directive-parse-error`** — surfaces
  malformed directive comments. Added to the `recommended` and `architecture`
  presets at error level so directive bugs cannot fail silently.

### Changed

- **BREAKING — option arrays now require structured `{value, reason}` entries.**
  The architecture rule options that used to accept bare-string arrays
  (`publicTypePackages`, `infrastructureTypePackages`, `allowedPublicSubpaths`,
  `allowedTestPublicSubpaths`, `sharedFolderNames`) now require objects with
  a written reason. The schema validates at lint time and rejects bare
  strings; the act of writing the reason IS the architectural
  acknowledgment. Strictness lists (`forbiddenSubpathSegments`,
  `implementationPathSegments`) stay as bare strings because adding entries
  makes the rule stricter, not more permissive.

  Migration:

  ```js
  // Before
  publicTypePackages: ["@typescript-eslint/utils"]
  // After
  publicTypePackages: [
    { package: "@typescript-eslint/utils", reason: "this package is an ESLint plugin" }
  ]

  // Before
  allowedPublicSubpaths: [".", "./cli", "./testing"]
  // After
  allowedPublicSubpaths: [
    { subpath: ".", reason: "primary entrypoint" },
    { subpath: "./cli", reason: "CLI invocation contract" },
    { subpath: "./testing", reason: "consumer test helpers" },
  ]

  // Before
  sharedFolderNames: ["shared", "common"]
  // After
  sharedFolderNames: [
    { folder: "shared", reason: "explicit shared kernel" },
    { folder: "common", reason: "explicit shared kernel" },
  ]
  ```
- **Option validation now uses Effect Schema.** `ArchitectureOptions` is
  defined as an Effect schema in `src/architecture/option-schemas.ts`;
  ESLint receives JSONSchema generated from it via `JSONSchema.make()`,
  and runtime decoding goes through `Schema.decodeUnknownEither`. Schema
  errors come back path-keyed via Effect's `ArrayFormatter` so the user
  sees exactly which option key was wrong.
- **The `recommended` preset now includes the architecture rules at curated severity:**
  7 errors (clear bugs — cycles, exposed internals, uncurated public boundaries,
  vendor-type leaks) and 8 warns (heuristic / layered-architecture / domain-dependent
  rules where the right call needs human judgment). The recommended preset is now
  38 rules total: 27 errors, 11 warns.
- Public-contract declaration is intentionally explicit. When `no-public-vendor-type-leak`
  legitimately fires (ESLint plugins re-exporting `@typescript-eslint/utils`,
  Node-targeted packages using `node:*`), declare the contract via the rule's
  `publicTypePackages` and `packageRuntime` options. No auto-detection, no preset
  shortcuts — typing those packages out *is* the "do I want this in my contract?"
  decision.
- Standalone preset is now `configs.architecture` (was `configs.topology`). All fifteen
  architecture rules at warn-level for incremental adoption.
- Source layout: analyzer subsystem moved from `src/topology/` to `src/architecture/`.
  All identifiers renamed (`TopologyOptions` → `ArchitectureOptions`,
  `cachedProjectTopology` → `cachedProjectArchitecture`, etc.).
- Architecture rule docs moved from `docs/rules/<rule>.md` to
  `docs/rules/architecture/<rule>.md`.

### Removed

- **`agent-code-guard/architecture-boundaries`** (formerly `topology-boundaries`)
  aggregate rule. The standalone `architecture` preset already covers the
  "turn them all on" use case via `...guard.configs.architecture.rules`. Users
  who enabled the aggregate rule directly should switch to the preset spread.

### Fixed

- `src/architecture/check-public-type-leaks.ts` and `src/architecture/source-program.ts`:
  removed mutation-test-confirmed dead code paths (the `@types/node` short-circuit,
  the `property.valueDeclaration` fallback, the `isTypeReference` helper, and the
  `configFile.error` early return) so the analyzer behavior is exactly what the
  tests assert.

### Testing

- New property tests for source-extension detection, sibling-specifier parsing,
  inventory barrel boundary conditions, public-signature depth-limit traversal
  with allowlisted generic containers, and message-content assertions on the
  no-public-vendor-type-leak and no-public-infra-type-leak diagnostics.

## [0.0.5] - 2026-04-24

### Added

- Two new runtime-safety rules:
  - `no-unbounded-concurrency`
  - `no-process-env-at-runtime`
- Per-rule docs and dedicated unit tests for both rules.
- Property coverage for bounded-concurrency false positives and shadowed `process` bindings.

### Testing

- Vitest suite expanded to 566 tests.
- Mutation score verified at 92.33%.

## [0.0.4] - 2026-04-24

### Added

- Three manual-algebra rules:
  - `manual-result`
  - `manual-option`
  - `manual-brand`
- Direct detector coverage in `manual-algebra-detection.test.ts` plus new AST-refinement property tests for unsupported containers and non-return annotations.

### Changed

- `manual-tagged-error` now uses the shared AST refinement helpers more consistently and avoids redundant error-name branches.
- `manual-algebra-detection` was simplified around shared key/literal collection and branch-pair detection, reducing rule-local dead branching.
- Package metadata now points at the `chughtapan/agent-code-guard` repository instead of the old `safer-by-default` repo path.

### Testing

- Vitest suite expanded to 540 tests.
- Mutation score hardened to 94.34%.

## [0.0.3] - 2026-04-22

### Added

- Six new rules focused on Effect/Either/tagged-error discipline:
  - `as-unknown-as`
  - `effect-promise`
  - `effect-error-erasure`
  - `either-discriminant`
  - `manual-tagged-error`
  - `tag-discriminant`

### Changed

- `manual-tagged-error` now catches returned manual tagged values and nested `_tag` payloads passed into error constructors and `Effect.fail(...)`.
- Rule tests were widened to cover private members, computed keys, unsupported AST shapes, and more negative cases around assertions, secrets, and raw throws.

### Testing

- Mutation score hardened to 98.25%.
- Vitest suite expanded to 384 tests.

## [0.0.2] - 2026-04-19

### BREAKING

- **Rule prefix normalized from `safer-by-default/*` to `agent-code-guard/*`.** Consumer configs must update `plugins: { 'safer-by-default': guard }` → `plugins: { 'agent-code-guard': guard }` and all rule IDs from `safer-by-default/<rule>` → `agent-code-guard/<rule>`. The rule namespace now matches the npm package name.
- **Package renamed to `eslint-plugin-agent-code-guard`** (previously `eslint-plugin-safer-by-default`). Rule namespace now matches the package name after the rename above.

### Added

Four new rules:

- **`no-raw-throw-new-error`** — flags `throw new Error(...)` and encourages tagged error types.
- **`no-test-skip-only`** — flags `.skip` and `.only` in test files (ships broken tests silently).
- **`no-coverage-threshold-gate`** — flags coverage-threshold config as a test-quality proxy (Goodhart's law).
- **`no-hardcoded-assertion-literals`** — flags magic-literal values in test assertions (e.g. `expect(x).toBe(42)` where `42` should be a named constant or computed). Includes `isTestFile` utility for test-file detection (supports `/e2e/` patterns).

### Changed

- **`no-hardcoded-secrets` widened to value-shape detection** — now flags long string literals by shape, not just by variable name.
- **Removed `.claude-plugin/` directory.** ACG is ESLint-plugin-only. The safer-by-default Claude Code plugin is distributed from [`chughtapan/safer-by-default`](https://github.com/chughtapan/safer-by-default).
- **`plugin.meta.version` reads from `package.json` at runtime** via `createRequire` (was previously hardcoded and drifted).

### Testing

- **Stryker mutation testing wired as required CI gate** (incremental + ignoreStatic + concurrency 4 + CI cache).
- **fast-check property tests** added for rule correctness.
- `no-raw-sql` mutation score hardened 40.63% → 93.75%.
- `promise-type` mutation score hardened to 100%.

## [0.0.1] - 2026-04-17

Initial release.

### Added

- Nine ESLint rules targeting patterns AI coding agents default to in TypeScript:
  - `async-keyword` — flags the `async` keyword on functions (declarations, expressions, arrows, methods).
  - `promise-type` — flags `Promise<...>` as a function return type annotation.
  - `then-chain` — flags `.then(...)` method calls.
  - `bare-catch` — flags `catch {}` and `catch (_err)` blocks that swallow errors.
  - `record-cast` — flags `as Record<string, unknown>` casts.
  - `no-manual-enum-cast` — flags hand-written `as "a" | "b" | "c"` string-union casts.
  - `no-raw-sql` — flags `.query(...)` calls with SQL string literals and `` sql`...` `` tagged templates.
  - `no-vitest-mocks` — flags `vi.mock`, `vi.hoisted`, `vi.spyOn` in integration tests.
  - `no-hardcoded-secrets` — flags long string literals assigned to secret-like names.
- Two presets: `recommended` (application source) and `integrationTests` (integration-test files).
- Per-rule documentation in `docs/rules/<name>.md` with Before/After examples.
- Companion `SKILL.md` Claude Code skill (`/safer-by-default`) articulating the agent-era code-safety philosophy that underpins the rules.
