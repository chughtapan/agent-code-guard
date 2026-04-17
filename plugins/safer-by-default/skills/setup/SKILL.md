---
description: One-time bootstrap for a TypeScript repo adopting safer-by-default. Detects existing ESLint config, installs eslint-plugin-safer-by-default, writes eslint.config.js, flips tsconfig strict flags, adds adjacent rules, and verifies the plugin fires. The user invokes this once per repo; do not auto-invoke.
disable-model-invocation: true
---

# /safer-by-default:setup

You are helping the user wire `eslint-plugin-safer-by-default` and the rules that pair well with it into this repository, so that from this point forward the floor of TypeScript code quality is enforced automatically. After this runs once, every future lint check catches the patterns that agents default to, and the `safer-by-default:typescript` skill quietly applies whenever an agent writes or reviews TypeScript.

The philosophy underneath this setup: agents do not pay the friction cost of ceremony. What a human team would skip as "not worth the time" costs you seconds. This bootstrap installs the ceremony on the user's behalf precisely because, for you, it is free. The companion skill `/safer-by-default:typescript` has the full recalibration if you want the reasoning.

Humans do not run setup by hand. You do. When a step says to ask the user, use `AskUserQuestion` with concrete options labeled A, B, C, D, and E where appropriate. When the repository state already makes an answer obvious, pick it yourself, state the choice out loud, and move on. Ambiguity is what the user is for.

The configuration in Steps 4, 5, and 6 is composed in your head as you go. You hold the shape of `eslint.config.js` as planning decisions and write it to disk exactly once in Step 7, not three times across the intervening steps. `tsconfig.json` and `package.json` are edited in place at the moments named.

## Step 0: Detect the existing state

Before installing or writing anything, read what the repository already has. This skill is required to be idempotent, which means running it twice on the same repository must not duplicate dependencies, overwrite user answers, or clobber working configuration.

```bash
# Determine the package manager from whichever lockfile is present.
[ -f pnpm-lock.yaml ] && echo "PM:pnpm"
[ -f package-lock.json ] && echo "PM:npm"
[ -f yarn.lock ] && echo "PM:yarn"

# Detect an existing flat config. Show the first thirty lines if one is present
# so the user (and you) can see what they would be overwriting.
[ -f eslint.config.js ] && echo "FLAT_CONFIG:exists" && head -30 eslint.config.js
[ -f eslint.config.mjs ] && echo "FLAT_CONFIG:exists-mjs"
[ -f eslint.config.ts ] && echo "FLAT_CONFIG:exists-ts"

# Detect a legacy .eslintrc in any of its usual forms.
[ -f .eslintrc ] || [ -f .eslintrc.json ] || [ -f .eslintrc.js ] || [ -f .eslintrc.cjs ] && echo "LEGACY_RC:exists"

# Detect whether the plugin is already declared as a dependency.
grep -q "safer-by-default" package.json 2>/dev/null && echo "PLUGIN:already-installed"

# Show the current tsconfig strict posture so later steps can be a diff, not a rewrite.
[ -f tsconfig.json ] && grep -E '"strict"|"noUncheckedIndexedAccess"|"exactOptionalPropertyTypes"|"noImplicitOverride"|"noFallthroughCasesInSwitch"' tsconfig.json
```

Resolve the package manager from that output. If two lockfiles somehow coexist, pick the one with the most recent modification time. If there is no lockfile at all, default to `pnpm` and say so to the user, so they can override if they prefer something else. Call the resolved package manager `<pm>` throughout the rest of this skill. Do not leave the literal string `<pm>` in commands you actually run or in messages you show the user; always substitute the name you resolved here.

### Branch: the plugin is already installed

If `PLUGIN:already-installed` appeared in the output, show the existing `eslint.config.js` to the user and ask via `AskUserQuestion`:

> Safer-by-default is already wired in this repo. What would you like to do?
> - A) Verify that it still works. I will run the lint, check that the rules fire, and report the current baseline.
> - B) Reconfigure from scratch. I will overwrite the existing config with new choices.
> - C) Update to the latest rule set. I will pull the newest plugin version without changing the config.
> - D) Nothing, it looks correct.

If the user chooses **A**, the existing `node_modules/` may be stale or missing, especially if the config was committed without installed dependencies, so run `<pm> install` first to hydrate the project. Then jump to Step 9 for the probe, Step 10 for the baseline, and Step 11 for the summary. You do not need Steps 1 through 8 in this path.

If the user chooses **B**, continue at Step 1 and run the full setup. When you reach Step 7 and are about to overwrite `eslint.config.js`, show the user the diff between the existing file and what you plan to write, and confirm before committing the change. Do not silently replace working configuration.

If the user chooses **C**, run `<pm> up eslint-plugin-safer-by-default`, then jump to Step 9, 10, and 11.

If the user chooses **D**, stop here. Produce a one-line summary that reports no changes.

### Branch: a legacy `.eslintrc` is present

If `LEGACY_RC:exists` appeared and no flat config was detected, this plugin cannot help. `eslint-plugin-safer-by-default` supports only the flat config system, which requires ESLint 9 or later. Tell the user plainly:

> This repository has a legacy `.eslintrc` config. `eslint-plugin-safer-by-default` only supports the flat config system (ESLint 9+). Please migrate to `eslint.config.js` first, then rerun `/safer-by-default:setup`.

Stop at that message. Do not try to migrate the `.eslintrc` yourself; that migration is a separate, user-scoped decision about their existing rules and plugins.

If both a flat config and a legacy `.eslintrc` are present, proceed on the clean-slate path below, but warn the user that ESLint 9 flat config takes precedence and the `.eslintrc` file is being ignored. Deleting it would prevent future confusion.

### Branch: clean slate

If none of the above branches applied, this is the happy path. Proceed to Step 1.

## Step 1: Check the peer dependencies

The plugin requires ESLint 9 or later and TypeScript 5 or later. Find out what the repository currently has:

```bash
<pm> ls eslint typescript --depth=0 2>&1 | tail -5
```

If either tool is missing or too old, install both as development dependencies:

```bash
<pm> add -D eslint@^9 typescript@^5
```

If the output of `<pm> ls` is empty, that means neither tool is installed at all, and you should install both. Empty output is not "all clear"; it is "nothing is here yet."

## Step 2: Install the plugin and the parser

```bash
<pm> add -D eslint-plugin-safer-by-default @typescript-eslint/parser
```

The parser is necessary for ESLint to understand TypeScript syntax. The plugin itself ships with no runtime dependencies beyond `@typescript-eslint/utils`.

If the repository uses Vitest for integration tests but does not already declare it as a dependency, make a mental note. The `no-vitest-mocks` rule only fires on code that imports from `vitest`, so there is nothing to do until the user decides to add it.

## Step 3: Ask where the integration tests live

Do not assume `**/*.integration.test.ts`. That is one common convention, but repositories arrange their integration tests in many different ways. Ask the user via `AskUserQuestion`:

> Where do your integration tests live? The `no-vitest-mocks` rule applies only to files matching this glob, so getting it right matters.
> - A) `**/*.integration.test.ts` (the suffix convention)
> - B) `tests/integration/**/*.ts` (a dedicated directory)
> - C) `src/**/*.integration.ts` (co-located with the code they test)
> - D) There are no integration tests in this repo yet. Skip the `integrationTests` block entirely.
> - E) Something else. I will tell you the glob.

Remember the user's answer. If they pick D, omit Block 2 of the configuration entirely in Step 5 and onward.

## Step 4: Ask about the stack

Two short questions, asked one after the other via `AskUserQuestion`.

First, about Effect:

> Does this project use Effect?
> - A) Yes, we are on Effect. Keep `async-keyword`, `promise-type`, and `then-chain` enabled.
> - B) No, we are not on Effect. Disable those three Effect-specific rules.
> - C) We are adopting Effect now. Keep them enabled as aspirational guardrails; they will catch code that predates the migration.

Second, about the database layer:

> Does this project use a typed query builder, such as Kysely, Drizzle, or Prisma's typed client?
> - A) Yes. Keep `no-raw-sql` enabled.
> - B) No. Disable `no-raw-sql`. Raw SQL without a typed builder is still a weakness, but without a builder there is no realistic fix.
> - C) There is no database in this project. The rule will never fire; it costs nothing to leave it on.

Regardless of the answers above, these four rules always stay on, because they are stack-independent: `bare-catch`, `record-cast`, `no-manual-enum-cast`, and `no-hardcoded-secrets`.

## Step 5: Plan the configuration shape

The final `eslint.config.js` will contain three blocks. You write the whole file once in Step 7, after Step 6 has added the companion rules. For now, hold the shape in your head.

**Block 1** targets application source. It spreads `guard.configs.recommended.rules` and then, based on the Step 4 answers, adds any necessary disables. It also adds the companion rules from Step 6 once those have been installed.

The stack disables to insert into Block 1, if the user answered "no" to the corresponding question in Step 4, look like this:

```js
// Included when the project is not on Effect.
"safer-by-default/async-keyword": "off",
"safer-by-default/promise-type":  "off",
"safer-by-default/then-chain":    "off",
```

```js
// Included when the project has no typed query builder.
"safer-by-default/no-raw-sql": "off",
```

**Block 2** targets integration tests and uses `guard.configs.integrationTests.rules` scoped to whichever glob the user gave in Step 3. Skip this block entirely if the user chose "no integration tests yet."

**Block 3** enables `require-description` on every `.ts` file in the project, regardless of directory. The overlap with Blocks 1 and 2 is intentional: the goal is that every `eslint-disable` directive anywhere in the project carries a written reason, not only the ones in application source.

## Step 6: Plan the companion rules

These rules are not part of `eslint-plugin-safer-by-default` itself, but they pair so well with it that the setup installs them too. Install all three in one command:

```bash
<pm> add -D @eslint-community/eslint-plugin-eslint-comments @typescript-eslint/eslint-plugin eslint-plugin-sonarjs
```

The rules to enable inside Block 1 alongside the spread and the Step 4 disables:

- `"@typescript-eslint/no-magic-numbers": "warn"`
- `"@typescript-eslint/no-unused-vars": "error"`
- `"sonarjs/no-duplicate-string": ["warn", { "threshold": 4 }]`

If any of these are already on elsewhere in the user's existing config, skip the ones that are already there rather than setting them again.

## Step 7: Write `eslint.config.js`

Before you write anything, check whether `package.json` contains `"type": "module"`. The configuration file uses ESM `import` syntax, which will not load in a CommonJS project without one of two fixes: add the field to `package.json`, or save the file as `eslint.config.mjs` instead of `eslint.config.js`. Pick whichever fits the project better and tell the user which you chose.

Now assemble all three blocks from Steps 4, 5, and 6 and write the file once. The final shape looks like this:

```js
import guard from "eslint-plugin-safer-by-default";
import tsParser from "@typescript-eslint/parser";
import comments from "@eslint-community/eslint-plugin-eslint-comments";
import tseslint from "@typescript-eslint/eslint-plugin";
import sonarjs from "eslint-plugin-sonarjs";

export default [
  // Block 1: application source.
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: {
      "safer-by-default": guard,
      "@typescript-eslint": tseslint,
      sonarjs,
    },
    rules: {
      ...guard.configs.recommended.rules,
      // Insert stack disables here if Step 4 said "no" to Effect or Kysely.
      "@typescript-eslint/no-magic-numbers": "warn",
      "@typescript-eslint/no-unused-vars": "error",
      "sonarjs/no-duplicate-string": ["warn", { threshold: 4 }],
    },
  },

  // Block 2: integration tests. Omit this whole block if Step 3 said "no integration tests yet."
  {
    files: ["<GLOB FROM STEP 3>"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "safer-by-default": guard },
    rules: guard.configs.integrationTests.rules,
  },

  // Block 3: every .ts file must give a reason for every eslint-disable directive.
  {
    files: ["**/*.ts"],
    plugins: { "eslint-comments": comments },
    rules: {
      "eslint-comments/require-description": ["error", { ignore: [] }],
    },
  },
];
```

## Step 8: Flip the `tsconfig.json` strict flags

Before you change anything in the `tsconfig.json`, capture the pre-strict baseline so you can report the delta honestly at the end:

```bash
<pm> exec tsc --noEmit 2>&1 | tee /tmp/safer-tsc-before.txt | grep -cE "error TS" || echo "0"
```

Then add the following five flags under `compilerOptions` in `tsconfig.json`. If any of them are already set to the values shown, leave those alone and add only the missing ones:

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

Capture the post-strict count the same way:

```bash
<pm> exec tsc --noEmit 2>&1 | tee /tmp/safer-tsc-after.txt | grep -cE "error TS" || echo "0"
```

Report the delta to the user as "N before, M after." If a single one of the new flags is responsible for most of the new errors (which you can see by looking at the error codes in `/tmp/safer-tsc-after.txt`), say so, and offer to turn that one flag off while leaving the other four on. Do not silently back out a flag on your own. Surface the tradeoff so the user decides.

## Step 9: Verify that the plugin actually fires

This is the proof step. Before you report any lint baseline, prove to yourself and to the user that the plugin is wired correctly by creating a file with a known anti-pattern, running ESLint on it, and confirming that the expected rule appears in the result.

Place the probe file inside the repository, because ESLint 9 refuses to lint files that fall outside the project's base path. The probe must also sit under one of the `files:` globs from the config you just wrote, which usually means `src/`.

```bash
mkdir -p src
cat > src/__safer_probe__.ts <<'EOF'
// Probe file for safer-by-default:setup verification. Deleted immediately after the check.
try { 1; } catch {}
EOF

<pm> exec eslint --format json src/__safer_probe__.ts > /tmp/safer-probe-out.json 2>/tmp/safer-probe-err.txt
PROBE_EXIT=$?

rm -f src/__safer_probe__.ts

# ESLint exit codes: 0 means no issues, 1 means lint errors, 2 means the config is broken.
# We expect exit 1 (the probe file deliberately violates bare-catch). Exit 2 means
# the plugin did not load at all. Exit 0 would mean the rule did not fire.
if [ "$PROBE_EXIT" = "2" ]; then
  echo "PROBE:failed. The eslint config is broken; stderr follows."
  cat /tmp/safer-probe-err.txt
elif grep -q '"ruleId":"safer-by-default/bare-catch"' /tmp/safer-probe-out.json 2>/dev/null; then
  echo "PROBE:passed"
else
  echo "PROBE:failed. The bare-catch rule did not fire on a file that should have triggered it."
  cat /tmp/safer-probe-out.json
  cat /tmp/safer-probe-err.txt
fi
```

If the result is `PROBE:passed`, the plugin is live, `safer-by-default/bare-catch` is reachable from the `files:` glob you configured, and you can proceed to Step 10.

If the result is `PROBE:failed`, stop. Surface the captured stderr and JSON to the user. Do not report a lint baseline on top of broken configuration, because the baseline would be a lie. Common causes of a failed probe:

- The `package.json` lacks `"type": "module"` and the config file uses ESM syntax, in which case rename the file to `eslint.config.mjs` or add the field.
- The probe file's path does not match any `files:` glob in the configuration, in which case adjust the glob or the probe location.
- A peer-dependency version is out of range and prevents `eslint-plugin-safer-by-default` from loading, in which case upgrade ESLint or TypeScript to a supported version.

## Step 10: Run the full lint and report the baseline

Now that you know the plugin is live, run ESLint against the entire project. Do not defer to the user's existing `"lint"` npm script; it is common for `"lint": "eslint src"` to miss the test files, and you want the full picture for the baseline.

```bash
<pm> exec eslint . 2>&1 | tail -40
```

Tabulate the violations by rule and present them as a table to the user:

| Rule | Violations |
|---|---|
| `safer-by-default/bare-catch` | 3 |
| `safer-by-default/no-hardcoded-secrets` | 1 |
| ... | ... |

Then ask via `AskUserQuestion` how to handle what the lint found:

> The baseline is N violations across M rules. How would you like to handle them?
> - A) Fix them now, rule by rule, in this session. I will rewrite the offending code to pass.
> - B) Freeze the current state as a baseline. I will save the per-rule counts to `.safer-baseline.json` for you to commit, and you wire CI to fail only when the count increases.
> - C) Fix a few specific rules now and defer the rest. I will list the rules and you pick.
> - D) Accept the baseline as it is. No action; you will fix violations as you touch the code.

If the user picks option B, write `.safer-baseline.json` at the repository root with the per-rule counts. Do not `git add` it and do not `git commit` it yourself. Tell the user what is in the file and leave the staging and commit for them to do. If they also want a CI step that regenerates the baseline and fails on any increase, mention that the pattern exists, but do not write the CI configuration on your own; that belongs to the user's CI platform of choice.

Some rule fixes, such as rewriting `async` into `Effect.gen`, change runtime behavior as well as type shape. Never silently mass-fix violations. The choice above exists so the user can opt into the grade of change they want.

## Step 11: Print the completion summary

End the skill with a bordered block that names every decision and outcome. This is the user's receipt:

```
════════════════════════════════════════════════════════════
  safer-by-default:setup is complete.
════════════════════════════════════════════════════════════
  Package manager:       <pm>
  Plugin version:        X.Y.Z
  eslint.config.js:      written (three blocks)
  Integration glob:      <from Step 3, or "skipped">
  Effect rules:          on / off
  Kysely rules:          on / off
  Companion rules:       no-magic-numbers, no-unused-vars, no-duplicate-string
  tsconfig strict:       N errors before, M errors after
  Lint baseline:         V violations across R rules
  Next action:           <whichever A/B/C/D the user chose in Step 10>
════════════════════════════════════════════════════════════
```

Then tell the user, in as many or as few words as feels right:

> The `safer-by-default:typescript` skill will apply itself in future sessions whenever you or another agent writes or reviews TypeScript in this repo. You do not need to invoke it. If you ever want to rerun this setup, because you adopted a new stack or moved your integration tests, just type `/safer-by-default:setup` again and it will detect the existing state and only do what is necessary.

## Important rules

Running this skill twice on the same repository must never duplicate dependencies or rewrite answers the user has already given. Step 0 exists precisely to make that true; trust it and use the branches it provides.

Never silently overwrite an existing `eslint.config.js`. Show the user what is there, show them the diff with what you plan to write, and wait for confirmation before committing the change.

Installing packages is routine and needs no confirmation. Rewriting a user's configuration file or flipping TypeScript strict flags is not routine; if either looks likely to cause surprise, pause and confirm first.

Never silently mass-fix lint violations. Fixes to `safer-by-default` rules can change runtime behavior as well as style. Step 10 offers the user four explicit choices; respect the one they make.

Do not commit files on the user's behalf. Write what this skill writes, report clearly what was written, and let the user stage and commit when they are ready. The `.safer-baseline.json` from Step 10 option B is the clearest example: write the file, tell the user it exists, and leave git alone.

If a step fails in a way this skill does not explicitly cover, such as a monorepo with package-specific configs, a custom parser option, or a non-ESM build system, stop and tell the user exactly what happened. Do not guess your way past ambiguity. The user will tell you how to proceed, or will choose to finish the setup by hand.

Finally, always resolve the `<pm>` placeholder before you use it. `<pm>` is a planning shorthand for readers of this skill; in any command you run and any message you show the user, substitute the real package manager name from Step 0.
