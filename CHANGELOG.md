# Changelog

## [Unreleased]

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
