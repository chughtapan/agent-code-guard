---
description: One-time bootstrap for a TypeScript repo adopting safer-by-default. Installs eslint-plugin-agent-code-guard, writes eslint.config.js, flips tsconfig strict flags, and adds adjacent rules. The user invokes this once per repo; do not auto-invoke.
disable-model-invocation: true
---

# /safer-by-default:setup

Run this on a fresh repo, or any repo where `eslint-plugin-agent-code-guard` isn't yet installed or wired. Confirm with the user at each major step. Don't guess past ambiguity.

Humans don't run setup steps by hand. You do.

## 1. Detect the package manager

Check in order: `pnpm-lock.yaml` → pnpm, `package-lock.json` → npm, `yarn.lock` → yarn. If none, ask the user which to use.

## 2. Check peer deps

- `eslint >= 9` (flat config). If below 9, ask the user to upgrade first. This plugin does not support legacy `.eslintrc` configs.
- `typescript >= 5`.

## 3. Install the plugin and parser

```sh
<pm> add -D eslint-plugin-agent-code-guard @typescript-eslint/parser
```

## 4. Wire `eslint.config.js`

Create or update `eslint.config.js` with the two-block setup: application source under `recommended`, integration tests under `integrationTests`. Ask the user for their integration-test glob before writing the config. Do not assume `**/*.integration.test.ts`; their tests may be under `tests/integration/**` or similar.

```js
import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
    plugins: { "agent-code-guard": guard },
    rules: guard.configs.recommended.rules,
  },
  {
    files: ["<USER'S INTEGRATION-TEST GLOB>"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
    plugins: { "agent-code-guard": guard },
    rules: guard.configs.integrationTests.rules,
  },
];
```

## 5. Adjust rules to the user's stack

Ask two questions before proceeding.

- **Effect?** If the user's project does not use Effect, disable `async-keyword`, `promise-type`, and `then-chain` in the application-source block. Don't suppress per-callsite. Turn them off at the preset level.
- **Kysely or Drizzle?** If the user's project has no typed query builder, disable `no-raw-sql`. Note that raw SQL without a typed builder will stay a weak spot regardless.

Always keep these on: `bare-catch`, `record-cast`, `no-manual-enum-cast`, `no-hardcoded-secrets`. They are stack-independent.

## 6. Install and wire `eslint-comments/require-description`

Every rule suppression must carry a written reason. Install and wire it.

```sh
<pm> add -D @eslint-community/eslint-plugin-eslint-comments
```

```js
import comments from "@eslint-community/eslint-plugin-eslint-comments";

// Add as a new config block in eslint.config.js:
{
  files: ["**/*.ts"],
  plugins: { "eslint-comments": comments },
  rules: { "eslint-comments/require-description": ["error", { ignore: [] }] },
}
```

## 7. Install companion rules if they aren't already

Skip any that are already on. Otherwise install:

```sh
<pm> add -D @typescript-eslint/eslint-plugin eslint-plugin-sonarjs
```

Enable these rules on the application-source block:

- `@typescript-eslint/no-magic-numbers`
- `@typescript-eslint/no-unused-vars`
- `sonarjs/no-duplicate-string`

## 8. Flip `tsconfig.json` strict flags

In the existing `tsconfig.json`, set these under `compilerOptions`. If any are already set, leave them. If any flag change breaks the existing codebase, surface the breakage. Don't silently back out.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## 9. Run the lint and report the baseline

Run `<pm> eslint .` (or whatever the user's lint script is). Report how many violations exist. Ask the user:

- Fix now, rule by rule, in this session?
- Accept the baseline and only block new violations (add an `.eslintignore`-style carve-out, or commit the baseline report so CI compares against it)?
- Fix specific rules now and defer others?

Do not silently fix everything without asking. Some rule fixes (rewriting `async` → `Effect.gen`) touch behavior, not just style.

## 10. Done

Report what shipped: installed packages, files touched, rules enabled, and the violation baseline. Tell the user that the `typescript` skill will auto-apply in future sessions whenever the agent writes or reviews TypeScript code; they don't need to invoke it.
