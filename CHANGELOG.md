# Changelog

## [0.0.2] - 2026-04-17

### Fixed

- **`plugin.meta.version` is no longer hardcoded.** It used to say `"0.1.0"` in `dist/index.js` even after the package was at `0.0.1`. Now it reads from `package.json` at runtime via `createRequire`, so it always matches the installed version.

### Changed — safer-by-default:setup skill

Dogfooded the skill against a fresh TS repo and closed the agent-execution gaps the test surfaced.

- **Step 1 now defaults to pnpm** when no lockfile exists, instead of punting to "ask the user." The skill is agent-run by design; silent punting blocks automated setup.
- **Step 2 now includes the exact `<pm> ls` command** and tells the agent to install `eslint` and `typescript` as devDeps when missing, instead of just checking and leaving the user stuck.
- **Step 4 makes the compose-once pattern explicit.** The `eslint.config.js` is composed in your head across Steps 4, 5, 6, and 7 and written to disk exactly once at the end of Step 7. Previously the steps read as three separate writes.
- **Step 5 spells out the exact `"off"` syntax** (spread the preset, then override with `"off"` entries below the spread). No more guessing about whether to mutate in place vs. spread-then-override.
- **Step 6 has a one-line comment** explaining why `files: ["**/*.ts"]` intentionally overlaps with the application-source and integration-test blocks.
- **Step 8 now captures a `tsc --noEmit` baseline before and after** the strict-flag flip, so the user gets a concrete delta ("12 errors before, 23 after, new errors are all from `noUncheckedIndexedAccess`") instead of vague "surface the breakage."
- **Step 9 mandates `<pm> exec eslint .`** for the baseline report. Deferring to the user's existing lint script silently skipped integration-test scopes (because many `"lint": "eslint src"` configs don't reach tests). The full scope catches more.

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
