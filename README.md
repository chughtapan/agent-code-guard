# eslint-plugin-agent-code-guard

[![npm](https://img.shields.io/npm/v/eslint-plugin-agent-code-guard.svg)](https://www.npmjs.com/package/eslint-plugin-agent-code-guard)
[![license](https://img.shields.io/npm/l/eslint-plugin-agent-code-guard.svg)](./LICENSE)

An opinionated ESLint plugin for repos where AI coding agents write most of the TypeScript. It guards against the patterns agents fall into by default — `async`/`await` sprawl, `Promise<>` return types, `.then()` chains, silently-swallowed `catch` blocks, unsafe casts, raw SQL in app code, manual enum casts, mocks in integration tests, and hardcoded secrets — and nudges code toward Effect + Kysely + real-dependency integration testing. Rules are AST-accurate (no regex guessing) and ship as a flat-config-ready plugin with two presets.

## How to adopt it (the real way)

**Don't wire this up by hand. Tell your coding agent to.**

This package ships a Claude Code skill at `SKILL.md`. The skill knows how to install the plugin, add it to `eslint.config.js`, adjust rules to your stack, enable adjacent rules that pair well (`eslint-comments/require-description`, `@typescript-eslint/no-magic-numbers`, etc.), and flip the relevant `tsconfig.json` strict flags. In one session your repo goes from "nothing" to "the floor and the ceiling are both wired up."

Activate the skill once per repo:

```sh
pnpm add -D eslint-plugin-agent-code-guard @typescript-eslint/parser
mkdir -p .claude/skills/safer-by-default
cp node_modules/eslint-plugin-agent-code-guard/SKILL.md .claude/skills/safer-by-default/SKILL.md
```

Then in any Claude Code session in that repo:

> /safer-by-default

The skill takes over from there — installs what's missing, writes the config, walks the tradeoffs with you, and leaves the repo set up.

The rest of this README is reference material for when you (or the agent) want to know what a specific rule catches, what's in each preset, or how to turn a rule off globally.

---

## Requirements

- `eslint >= 9` (flat config)
- `typescript >= 5`
- A TypeScript parser (`@typescript-eslint/parser`)

## Manual configure

If you don't want to use the skill, add to `eslint.config.js`:

```js
// eslint.config.js
import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  // Application source.
  {
    files: ["src/**/*.ts", "packages/*/src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**", "**/test-utils/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "agent-code-guard": guard },
    rules: guard.configs.recommended.rules,
  },

  // Integration tests. Change `files:` to match your integration-test glob.
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

File-scoping is deliberately up to you. Rules are pure pattern detectors — no runtime filesystem reads, no guessing. If your integration tests live under `tests/integration/**`, change the `files:` line. Same for production source.

## Presets

| Preset | Scope | Rules |
|---|---|---|
| `recommended` | Application source | `async-keyword`, `promise-type`, `then-chain`, `bare-catch`, `record-cast`, `no-raw-sql`, `no-manual-enum-cast`, `no-hardcoded-secrets` |
| `integrationTests` | Integration-test files (via `files:` filter) | `no-vitest-mocks` |

## Adjusting rules to your stack

The `recommended` preset assumes you're moving toward Effect + Kysely. If you're not, turn off the rules that don't fit **in `eslint.config.js`** — not with per-call `eslint-disable` comments.

```js
{
  files: ["src/**/*.ts"],
  plugins: { "agent-code-guard": guard },
  rules: {
    ...guard.configs.recommended.rules,

    // Not using Effect:
    "agent-code-guard/async-keyword": "off",
    "agent-code-guard/promise-type":  "off",
    "agent-code-guard/then-chain":    "off",

    // Not using a typed query builder (Kysely, Drizzle):
    "agent-code-guard/no-raw-sql":    "off",
  },
}
```

Rules always worth keeping regardless of stack: `bare-catch`, `record-cast`, `no-manual-enum-cast`, `no-hardcoded-secrets`. `no-vitest-mocks` only applies via the `integrationTests` preset, so it's a no-op on projects without integration tests.

## Rules

### Effect-discipline rules

#### `agent-code-guard/async-keyword`
Flags `async` on any function (declarations, expressions, arrows, class methods, object method shorthand). In Effect-first code, asynchrony is modeled with `Effect.gen` and Effect handlers.

#### `agent-code-guard/promise-type`
Flags `Promise<...>` used as a function return type annotation. Nested uses like `Map<string, Promise<X>>` are allowed — you still consume third-party promise-returning APIs. What you don't want is your own functions announcing `Promise<X>` as a contract. Prefer `Effect<A, E, R>`.

#### `agent-code-guard/then-chain`
Flags any `.then(...)` call. Compose with `Effect.flatMap` / `Effect.map` via `Effect.promise` or `Effect.tryPromise` instead of chaining thenables.

#### `agent-code-guard/bare-catch`
Flags `try`/`catch` blocks that either omit the caught error (`} catch {`) or bind it to an underscore-prefixed name (`catch (_)`, `catch (_err)`). Silently dropped errors turn debuggable failures into mysteries.

### Type-safety rules

#### `agent-code-guard/record-cast`
Flags `as Record<string, unknown>` casts. Usually papers over a missing schema or validation step. Decode into a typed result (Effect `Schema`, Zod) instead.

#### `agent-code-guard/no-manual-enum-cast`
Flags `as "a" | "b" | "c"` string-union casts — inlining enum values bypasses the generated types from your DB or API schema. Import the canonical union type instead.

#### `agent-code-guard/no-raw-sql`
Flags `.query(...)` calls where the first argument looks like SQL (starts with `SELECT`/`INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP`/`WITH`), or uses a `` sql`...` `` tagged template. Use a typed query builder (Kysely, Drizzle) so results are typed end-to-end.

### Test-integrity rules

#### `agent-code-guard/no-vitest-mocks`
Flags `vi.mock` / `vi.hoisted` / `vi.spyOn` calls. Scope it (via `files:`) to wherever you draw the "real dependencies only" line — typically `**/*.integration.test.ts`. Unit tests can still mock freely.

#### `agent-code-guard/no-hardcoded-secrets`
Flags string literals ≥ 20 chars assigned to names matching `apiKey` / `secret` / `token` / `password` / `authToken`. Placeholder values (`test`, `dummy`, `placeholder`, `your-key-here`) are allowed. Works everywhere — hardcoded secrets shouldn't live in production source either.

## Suppressions require a reason

When you need to suppress a rule at a specific callsite (not disable it globally), give a reason. Install [`@eslint-community/eslint-plugin-eslint-comments`](https://www.npmjs.com/package/@eslint-community/eslint-plugin-eslint-comments) and turn on `eslint-comments/require-description`:

```ts
// eslint-disable-next-line agent-code-guard/async-keyword -- interop with legacy API, migration tracked in #123
async function legacyHandler() { /* ... */ }
```

Recipe:

```js
import comments from "@eslint-community/eslint-plugin-eslint-comments";

export default [
  {
    files: ["**/*.ts"],
    plugins: { "eslint-comments": comments },
    rules: {
      "eslint-comments/require-description": ["error", { ignore: [] }],
    },
  },
  // ... agent-code-guard blocks above
];
```

## Companion ESLint rules worth enabling

This plugin focuses on patterns no existing rule covers well. For common adjacent concerns, enable these:

| Concern | Rule to enable | Source |
|---|---|---|
| Magic numbers inline in code | `@typescript-eslint/no-magic-numbers` | `@typescript-eslint/eslint-plugin` |
| Duplicated magic string literals | `sonarjs/no-duplicate-string` | `eslint-plugin-sonarjs` |
| Unused variables / dead code | `@typescript-eslint/no-unused-vars` | `@typescript-eslint/eslint-plugin` |
| High-entropy strings anywhere (broader secret scan) | `no-secrets/no-secrets` | `eslint-plugin-no-secrets` |
| General promise hygiene (when NOT going full Effect) | `eslint-plugin-promise` — note: it promotes `async`/`await`, which conflicts with our `async-keyword`. Pick one side. | `eslint-plugin-promise` |

## For agents: where rule docs ship

Each rule has a `docs/rules/<name>.md` file with a Before (flagged) / After (preferred) code example. These ship inside the installed package, so agents with filesystem access can read them directly:

```
node_modules/eslint-plugin-agent-code-guard/docs/rules/<rule-name>.md
```

The same files back `meta.docs.url` on each rule, so IDEs and `eslint --rule-docs` resolve to the corresponding file on GitHub.

## License

MIT
