---
description: One-time bootstrap for a TypeScript repo adopting safer-by-default. Installs eslint-plugin-agent-code-guard, writes eslint.config.js, flips tsconfig strict flags, and adds adjacent rules. The user invokes this once per repo; do not auto-invoke.
disable-model-invocation: true
---

# /safer-by-default:setup

Run this on a fresh repo, or any repo where `eslint-plugin-agent-code-guard` isn't yet installed or wired. Confirm with the user at every major step. Don't guess past ambiguity.

**Humans don't run setup steps by hand. You do.** So when a step references a decision ("ask the user"), ask via AskUserQuestion. If the repo state makes the answer obvious, go ahead and pick it, state the choice, and move on.

The config blocks in Steps 4, 5, 6, and 7 are composed in your head as you go. **Write `eslint.config.js` once, after Step 7**, not three times.

## 1. Detect the package manager

Check in order: `pnpm-lock.yaml` → `pnpm`, `package-lock.json` → `npm`, `yarn.lock` → `yarn`. Remember the choice; call it `<pm>` throughout this skill.

If no lockfile exists, default to `pnpm`. State the default to the user so they can override.

## 2. Check peer deps

Run:

```sh
<pm> ls eslint typescript --depth=0
```

Requirements:

- `eslint >= 9` (flat config only; this plugin does not support legacy `.eslintrc`).
- `typescript >= 5`.

If either is missing or too old, install/upgrade it as a devDep:

```sh
<pm> add -D eslint@^9 typescript@^5
```

## 3. Install the plugin and parser

```sh
<pm> add -D eslint-plugin-agent-code-guard @typescript-eslint/parser
```

## 4. Compose the application-source block (don't write the file yet)

Plan an `eslint.config.js` application-source block that looks like this. **Do not write the file until Step 7 is composed too.**

```js
import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

{
  files: ["src/**/*.ts"],
  ignores: ["**/*.test.ts", "**/*.spec.ts"],
  languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
  plugins: { "agent-code-guard": guard },
  rules: {
    ...guard.configs.recommended.rules,
    // Step 5 may spread in additional `"...": "off"` entries below.
  },
}
```

Ask the user for their integration-test glob. Don't assume `**/*.integration.test.ts`; their tests may be under `tests/integration/**`, `src/**/*.integration.ts`, or similar. Plan an integration-tests block:

```js
{
  files: ["<USER'S INTEGRATION-TEST GLOB>"],
  languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
  plugins: { "agent-code-guard": guard },
  rules: guard.configs.integrationTests.rules,
}
```

## 5. Adjust rules to the user's stack

Ask two questions before proceeding.

- **Effect?** If the user's project does not use Effect, add these `"off"` entries to the application-source block's `rules:` (right after the spread):
  ```js
  "agent-code-guard/async-keyword": "off",
  "agent-code-guard/promise-type":  "off",
  "agent-code-guard/then-chain":    "off",
  ```
- **Kysely or Drizzle?** If no typed query builder, add:
  ```js
  "agent-code-guard/no-raw-sql": "off",
  ```

Don't suppress per-callsite. Turn them off at the preset level.

Always keep these on regardless of stack: `bare-catch`, `record-cast`, `no-manual-enum-cast`, `no-hardcoded-secrets`. They are stack-independent.

## 6. Plan `eslint-comments/require-description`

Every rule suppression must carry a written reason. Plan a third block:

```sh
<pm> add -D @eslint-community/eslint-plugin-eslint-comments
```

```js
import comments from "@eslint-community/eslint-plugin-eslint-comments";

// Applies to every .ts file, including tests and integration tests.
// Yes, this overlaps with the blocks above on purpose, so the require-description
// rule reaches every suppression comment regardless of file.
{
  files: ["**/*.ts"],
  plugins: { "eslint-comments": comments },
  rules: { "eslint-comments/require-description": ["error", { ignore: [] }] },
}
```

## 7. Plan companion rules and write the config

```sh
<pm> add -D @typescript-eslint/eslint-plugin eslint-plugin-sonarjs
```

Add these rules to the application-source block's `rules:` (alongside the spreads and `"off"` entries from Steps 4-5):

- `@typescript-eslint/no-magic-numbers`
- `@typescript-eslint/no-unused-vars`
- `sonarjs/no-duplicate-string`

**Now write `eslint.config.js`** with all three blocks composed: application source (Step 4 + Step 5 + Step 7 rules), integration tests (Step 4), and require-description (Step 6). One write, end of config planning.

## 8. Flip `tsconfig.json` strict flags

Before you change anything, capture the pre-strict baseline:

```sh
<pm> exec tsc --noEmit 2>&1 | tee /tmp/tsc-before.txt | tail -1
```

Then set these under `compilerOptions` in `tsconfig.json`. If any are already set, leave them. Do not silently back out a flag if it breaks the existing codebase; surface the breakage and let the user decide.

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

Capture the post-strict count:

```sh
<pm> exec tsc --noEmit 2>&1 | tee /tmp/tsc-after.txt | tail -1
```

Report the delta to the user: `before → after`. If a flag introduced a lot of breakage, flag it and offer to turn that one flag off while leaving the others on.

## 9. Run the lint and report the baseline

Use `<pm> exec eslint .` for the baseline. Do not defer to the user's existing lint script (`package.json#scripts.lint`), which often scopes to `src/` only and will skip test files. You want the full picture.

```sh
<pm> exec eslint .
```

Count violations by rule. Report as a table:

| Rule | Violations |
|---|---|
| `agent-code-guard/bare-catch` | 3 |
| ... | ... |

Ask the user:

- Fix now, rule by rule, in this session?
- Accept the baseline and only block new violations (commit a baseline report so CI compares against it)?
- Fix specific rules now and defer others?

Do not silently fix everything without asking. Some rule fixes (rewriting `async` → `Effect.gen`) touch behavior, not just style.

## 10. Done

Report what shipped, end of session:

- Packages installed (with versions).
- Files touched (`eslint.config.js`, `tsconfig.json`, `package.json`).
- Strict-flag delta from Step 8.
- Lint baseline from Step 9.
- Rules enabled, rules turned off, and why.

Tell the user:

> The `typescript` skill will auto-apply in future sessions whenever the agent writes or reviews TypeScript code. You don't need to invoke it.
