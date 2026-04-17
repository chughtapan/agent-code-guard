# eslint-plugin-agent-code-guard

An opinionated ESLint plugin for repos where AI coding agents write most of the TypeScript. It guards against the patterns agents fall into by default — `async`/`await` sprawl, `Promise<>` return types, `.then()` chains, silently-swallowed `catch` blocks, unsafe casts, raw SQL in app code, manual enum casts, mocks in integration tests, and hardcoded secrets — and nudges code toward Effect + Kysely + real-dependency integration testing. Rules are AST-accurate (no regex guessing) and ship as a flat-config-ready plugin with two presets.

## Install

```sh
pnpm add -D eslint-plugin-agent-code-guard
```

Peer deps: `eslint >= 9`, `typescript >= 5`.

## Flat-config usage

```js
// eslint.config.js
import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  // Apply the default preset to application source.
  {
    files: ["src/**/*.ts", "packages/*/src/**/*.ts"],
    ignores: [
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/__tests__/**",
      "**/test-utils/**",
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "agent-code-guard": guard },
    rules: guard.configs.recommended.rules,
  },

  // Scope the integration-test preset to YOUR integration-test glob.
  // Change the pattern here to match whatever your vitest/jest config uses.
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

File-scoping is deliberately up to you. Rules stay pure pattern detectors — no runtime filesystem reads, no guessing. If your integration tests live under `tests/integration/**`, change the `files:` line. Same for production source.

## Presets

| Preset | Scope | Rules |
|---|---|---|
| `recommended` | Application source | `async-keyword`, `promise-type`, `then-chain`, `bare-catch`, `record-cast`, `no-raw-sql`, `no-manual-enum-cast`, `no-hardcoded-secrets` |
| `integrationTests` | Integration-test files (via `files:` filter) | `no-vitest-mocks` |

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

## Companion rules you should also enable

This plugin focuses on patterns no existing rule covers well. For common adjacent concerns, enable these instead of waiting for us to duplicate them:

| Concern | Rule to enable | Source |
|---|---|---|
| Magic numbers inline in code | `@typescript-eslint/no-magic-numbers` | `@typescript-eslint/eslint-plugin` |
| Duplicated magic string literals | `sonarjs/no-duplicate-string` | `eslint-plugin-sonarjs` |
| Unused variables / dead code | `@typescript-eslint/no-unused-vars` | `@typescript-eslint/eslint-plugin` |
| High-entropy strings anywhere (broader secret scan) | `no-secrets/no-secrets` | `eslint-plugin-no-secrets` |
| General promise hygiene (when NOT going full Effect) | `eslint-plugin-promise` — but note it promotes `async`/`await`, which conflicts with our `async-keyword`. Pick one side. | `eslint-plugin-promise` |

## Disable syntax (reason required)

All suppressions must carry a reason. Install [`@eslint-community/eslint-plugin-eslint-comments`](https://www.npmjs.com/package/@eslint-community/eslint-plugin-eslint-comments) and enable `eslint-comments/require-description` so ESLint rejects disables without `-- <reason>`:

```ts
// eslint-disable-next-line agent-code-guard/async-keyword -- interop with legacy API, migration tracked in #123
async function legacyHandler() { /* ... */ }
```

Copy-paste recipe:

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

## Contributing

To add a rule:

1. Create `src/rules/<rule-name>.ts` exporting a `TSESLint.RuleModule` via `createRule`.
2. Register it in `src/index.ts` (rules map + the relevant preset).
3. Add `tests/<rule-name>.test.ts` with ≥3 valid and ≥5 invalid cases, plus a suppression case.
4. Document the rule in this README under the right section.
5. `pnpm build && pnpm test` must pass.

## License

MIT
