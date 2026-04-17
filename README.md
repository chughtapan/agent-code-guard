# eslint-plugin-agent-code-guard

[![npm](https://img.shields.io/npm/v/eslint-plugin-agent-code-guard.svg)](https://www.npmjs.com/package/eslint-plugin-agent-code-guard)
[![license](https://img.shields.io/npm/l/eslint-plugin-agent-code-guard.svg)](./LICENSE)

An opinionated ESLint plugin for TypeScript repos where AI agents write most of the code. Nine AST-accurate rules that catch the patterns agents default to, and nudge toward Effect + Kysely + real-dependency testing.

```ts
// flagged:
try { op(); } catch {}                      // bare-catch
const body = (await r.json()) as Record<string, unknown>;  // record-cast
const users = await db.query("SELECT * FROM users");       // no-raw-sql
async function f(): Promise<User> { ... }   // async-keyword + promise-type
```

## Install

Don't wire this up by hand. The package ships a Claude Code skill that does the setup for you: installs the plugin, writes `eslint.config.js`, flips `tsconfig.json` strict flags, and adds adjacent rules worth pairing.

```sh
pnpm add -D eslint-plugin-agent-code-guard @typescript-eslint/parser
mkdir -p .claude/skills/safer-by-default
cp node_modules/eslint-plugin-agent-code-guard/SKILL.md .claude/skills/safer-by-default/SKILL.md
```

Then in any Claude Code session in that repo:

> /safer-by-default

Requires `eslint >= 9`, `typescript >= 5`.

## Manual config

Skipping the skill? Add to `eslint.config.js`:

```js
import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
    plugins: { "agent-code-guard": guard },
    rules: {
      ...guard.configs.recommended.rules,
      // Not on Effect? Turn these off:
      // "agent-code-guard/async-keyword": "off",
      // "agent-code-guard/promise-type":  "off",
      // "agent-code-guard/then-chain":    "off",
      // Not on Kysely/Drizzle? Turn this off:
      // "agent-code-guard/no-raw-sql":    "off",
    },
  },
  {
    files: ["**/*.integration.test.ts"], // change to your integration-test glob
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
    plugins: { "agent-code-guard": guard },
    rules: guard.configs.integrationTests.rules,
  },
];
```

Always-on regardless of stack: `bare-catch`, `record-cast`, `no-manual-enum-cast`, `no-hardcoded-secrets`.

## Rules

| Rule | Catches |
|---|---|
| [`async-keyword`](./docs/rules/async-keyword.md) | `async` on any function |
| [`promise-type`](./docs/rules/promise-type.md) | `Promise<...>` as a return type annotation |
| [`then-chain`](./docs/rules/then-chain.md) | `.then(...)` calls |
| [`bare-catch`](./docs/rules/bare-catch.md) | `catch {}` and `catch (_err)` that swallow errors |
| [`record-cast`](./docs/rules/record-cast.md) | `as Record<string, unknown>` |
| [`no-manual-enum-cast`](./docs/rules/no-manual-enum-cast.md) | Hand-written `as "a" \| "b" \| "c"` |
| [`no-raw-sql`](./docs/rules/no-raw-sql.md) | `.query("SELECT ...")` and `` sql`...` `` templates |
| [`no-vitest-mocks`](./docs/rules/no-vitest-mocks.md) | `vi.mock` / `vi.spyOn` in integration tests |
| [`no-hardcoded-secrets`](./docs/rules/no-hardcoded-secrets.md) | Long strings assigned to `apiKey` / `token` / `secret` |

Each rule ships a Before/After doc at `docs/rules/<name>.md`. They also ship inside the installed package at `node_modules/eslint-plugin-agent-code-guard/docs/rules/<name>.md`, so agents can read them without a network request.

## Suppress with a reason

Install [`@eslint-community/eslint-plugin-eslint-comments`](https://www.npmjs.com/package/@eslint-community/eslint-plugin-eslint-comments) and turn on `eslint-comments/require-description` to force every `eslint-disable` to carry a reason:

```ts
// eslint-disable-next-line agent-code-guard/async-keyword -- Next.js route handler requires async
export async function GET(req: Request) { ... }
```

## Pair with

| Concern | Rule |
|---|---|
| Magic numbers | `@typescript-eslint/no-magic-numbers` |
| Duplicate strings | `sonarjs/no-duplicate-string` |
| Unused variables | `@typescript-eslint/no-unused-vars` |
| Broader secret scan | `no-secrets/no-secrets` |
| Promise hygiene (if not on Effect) | `eslint-plugin-promise` — note: conflicts with our `async-keyword`, pick one |

## License

MIT
