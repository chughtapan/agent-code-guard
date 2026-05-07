# Changelog

## [Unreleased]

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
- Per-rule docs under [`docs/rules/architecture/`](docs/rules/architecture/) and a Boundary
  Ledger design doc at [`docs/architecture-boundary-ledger.md`](docs/architecture-boundary-ledger.md).
- Tag-driven npm publish workflow (`.github/workflows/publish.yml`).

### Changed

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
- Boundary Ledger doc renamed: `docs/topology-boundary-ledger.md` →
  `docs/architecture-boundary-ledger.md`.

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
