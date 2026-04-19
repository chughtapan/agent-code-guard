---
name: setup
version: 0.1.0
description: |
  One-time bootstrap for a TypeScript repo adopting safer-by-default. Detects
  the package manager, existing ESLint config, and tsconfig strict posture;
  installs eslint-plugin-agent-code-guard and companion rules; writes
  eslint.config.js in three blocks; flips tsconfig strict flags; probes that
  the lint actually fires on a known anti-pattern; reports the lint baseline
  and asks the user how to handle it. User-invoked only; never auto-routes.
  Safe to re-run; idempotent by construction.
triggers:
  - set up safer
  - install agent-code-guard
  - bootstrap ts repo
  - configure eslint safer
  - enable strict
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - AskUserQuestion
---

# /safer:setup

## Read first

Read `PRINCIPLES.md` at the plugin root. This skill is the projection of the principles onto **the bootstrap moment**. Specifically:

- **Principle 1 (Types beat tests).** The tsconfig strict flags this skill flips are how TypeScript becomes your ally against classes of error, not a suggestion engine.
- **Principle 2 (Validate at every boundary).** The lint rules this skill installs catch the patterns that bypass boundary validation: bare casts, raw SQL, hardcoded secrets.
- **Principle 3 (Errors are typed).** The `bare-catch`, `async-keyword`, and `promise-type` rules are the lint floor for the typed-errors principle.
- **Principle 4 (Exhaustiveness).** Strict flags plus `bare-catch` together make the compiler look at every branch.
- **Artifact discipline: Cold Start Test.** This skill's output is `eslint.config.js` and `tsconfig.json` edits on disk. They are the durable artifact; future agents read them without reading this session.

## Role

You are helping the user wire `eslint-plugin-agent-code-guard` and the rules that pair well with it into one TypeScript repository. After this runs once, every future lint check catches the patterns agents default to, and `/safer:typescript` applies in context whenever TypeScript is written or reviewed.

Concretely, you:

1. Detect the repo state: package manager, existing eslint config, strict flags, whether the plugin is already installed.
2. Branch on existing state: verify, reconfigure, update, walk away, or proceed clean.
3. Install peer dependencies if missing, install the plugin and parser, install the companion rules.
4. Ask the user two small questions about the stack, one question about where integration tests live.
5. Plan the three-block `eslint.config.js` in your head, then write it once.
6. Flip the five tsconfig strict flags; measure the TypeScript error delta.
7. Probe that the lint actually fires on a file that should violate it.
8. Run the full lint, tabulate by rule, ask the user how to handle the baseline.
9. Print a bordered completion summary.

This skill does not escalate. It asks via `AskUserQuestion` when ambiguous. It does not commit files on the user's behalf.

## Inputs required

- A TypeScript repository with a `tsconfig.json` at the current working directory, or at a subdirectory the user has named.
- `gh` is **not** required (this skill is local-only; no GitHub publication).
- One of the supported package managers: `pnpm`, `npm`, `yarn`, or `bun`. Detected in Step 1.

### Preamble (run first)

```bash
eval "$(safer-slug 2>/dev/null)" || true
SESSION="$$-$(date +%s)"
_TEL_START=$(date +%s)
safer-telemetry-log --event-type safer.skill_run --modality setup --session "$SESSION" 2>/dev/null || true
_UPD=$(safer-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD"

if [ ! -f tsconfig.json ] && [ ! -f package.json ]; then
  echo "ERROR: no tsconfig.json or package.json in $(pwd). Run this skill from a TypeScript project root."
  exit 1
fi

REPO_ROOT=$(pwd)
echo "REPO_ROOT: $REPO_ROOT"
echo "SESSION:   $SESSION"
```

If `safer-update-check` or `safer-telemetry-log` is missing, continue. Telemetry is optional.

## Scope

**In scope:**
- Detecting repo state: package manager, eslint config shape, tsconfig strict flags, whether the plugin is already present.
- Installing dev dependencies through the detected package manager.
- Writing `eslint.config.js` (or `eslint.config.mjs` if the project is CommonJS).
- Editing `tsconfig.json` to turn on the five strict flags.
- Running a probe lint and a full lint.
- Offering the user a choice on how to handle the baseline.
- Writing `.safer-baseline.json` if the user picks the freeze option.
- Printing a completion summary.

**Forbidden:**
- Committing any of the files this skill writes. The user stages and commits.
- Migrating a legacy `.eslintrc` to flat config. That is a separate decision.
- Auto-fixing lint violations without the user's explicit choice. Some fixes change runtime behavior.
- Silently overwriting an existing `eslint.config.js`. Diff first; confirm; then write.
- Auto-invoking (the skill is marked `disable-model-invocation: true`; users invoke it explicitly).

## Scope budget

- **One repository.** The skill operates on the current working directory.
- **One flat config.** If a legacy `.eslintrc` is present and no flat config exists, stop and tell the user to migrate.
- **One run per outcome.** Idempotent: re-running on an already-configured repo hits the "already installed" branch and offers verify / reconfigure / update / walk.
- **No silent mass fix.** The baseline step always asks the user; it never chooses on their behalf.

## Workflow

### Step 0: Detect the existing state

Read what the repo already has. Do not install or write anything yet.

```bash
# Detect package manager from the lockfile.
PM=""
[ -f pnpm-lock.yaml ]   && PM="pnpm"
[ -f package-lock.json ] && PM="npm"
[ -f yarn.lock ]         && PM="yarn"
[ -f bun.lockb ]         && PM="bun"
[ -z "$PM" ] && PM="pnpm"  # default, announce to user below
echo "PM: $PM"

# Detect flat config.
FLAT_CONFIG=""
[ -f eslint.config.js  ] && FLAT_CONFIG="eslint.config.js"
[ -f eslint.config.mjs ] && FLAT_CONFIG="eslint.config.mjs"
[ -f eslint.config.ts  ] && FLAT_CONFIG="eslint.config.ts"
echo "FLAT_CONFIG: ${FLAT_CONFIG:-none}"

# Detect legacy .eslintrc.
LEGACY=""
for f in .eslintrc .eslintrc.json .eslintrc.js .eslintrc.cjs .eslintrc.yaml .eslintrc.yml; do
  [ -f "$f" ] && LEGACY="$f" && break
done
echo "LEGACY_RC: ${LEGACY:-none}"

# Detect whether the plugin is already declared.
PLUGIN_INSTALLED="no"
grep -q "eslint-plugin-agent-code-guard" package.json 2>/dev/null && PLUGIN_INSTALLED="yes"
echo "PLUGIN_INSTALLED: $PLUGIN_INSTALLED"

# Show current tsconfig strict posture.
echo "TSCONFIG_STRICT:"
grep -E '"strict"|"noUncheckedIndexedAccess"|"exactOptionalPropertyTypes"|"noImplicitOverride"|"noFallthroughCasesInSwitch"' tsconfig.json 2>/dev/null || echo "  (no strict flags set)"

# Check type: module.
IS_ESM="no"
grep -q '"type"[[:space:]]*:[[:space:]]*"module"' package.json 2>/dev/null && IS_ESM="yes"
echo "IS_ESM: $IS_ESM"
```

Announce to the user what you found. If `PM` fell back to the default, say so: "No lockfile found; defaulting to pnpm. Tell me now if you use a different package manager."

### Step 0a: Branch on existing state

**If `PLUGIN_INSTALLED` is `yes`:** ask via `AskUserQuestion` with these four options:

- A) Verify. Hydrate `node_modules` with `<pm> install`, run the probe, run the full lint, report the baseline. No config changes.
- B) Reconfigure from scratch. Overwrite `eslint.config.js` with new choices. Show the diff first; confirm.
- C) Update. Run `<pm> up eslint-plugin-agent-code-guard`; re-probe; re-baseline. No config changes.
- D) Walk away. Stop here; report no changes.

If A, skip to Step 8 (probe). If C, skip to Step 8 after the upgrade. If D, stop and emit the one-line summary.

**If `LEGACY` is set and `FLAT_CONFIG` is empty:** stop. Tell the user:

> This repo has a legacy `.eslintrc` config. `eslint-plugin-agent-code-guard` only supports the flat config system (ESLint 9 and later). Migrate `.eslintrc` to `eslint.config.js` first, then re-run `/safer:setup`.

Do not attempt the migration yourself. That belongs to the user's judgement about their existing rules.

**If both `LEGACY` and `FLAT_CONFIG` are set:** proceed on the clean-slate path, but warn the user that ESLint 9 flat config takes precedence and the `.eslintrc` file is being ignored. Deleting it later avoids confusion.

**Else (clean slate):** proceed to Step 1.

### Step 1: Check peer dependencies

The plugin requires `eslint >= 9` and `typescript >= 5`. Check:

```bash
$PM ls eslint typescript --depth=0 2>&1 | tail -5
```

If either is missing or below the minimum, install both as dev dependencies:

```bash
$PM add -D eslint@^9 typescript@^5
```

Empty output from `$PM ls` means neither is installed. Install both.

### Step 2: Install the plugin and parser

```bash
$PM add -D eslint-plugin-agent-code-guard @typescript-eslint/parser
```

The parser lets ESLint understand TypeScript syntax. The plugin itself has no runtime dependencies beyond `@typescript-eslint/utils`.

### Step 3: Ask where integration tests live

Do not assume `**/*.integration.test.ts`. Ask via `AskUserQuestion`:

> Where do your integration tests live? The `no-vitest-mocks` rule applies only to files matching this glob.
> - A) `**/*.integration.test.ts` (suffix convention)
> - B) `tests/integration/**/*.ts` (dedicated directory)
> - C) `src/**/*.integration.ts` (co-located)
> - D) None in this repo yet. Skip the integration-tests block.
> - E) Something else. I will tell you the glob.

Remember the answer. If D, Block 2 of the config is omitted entirely.

### Step 4: Ask about the stack

Two questions, one after the other via `AskUserQuestion`.

First, about Effect:

> Does this project use Effect?
> - A) Yes; keep `async-keyword`, `promise-type`, `then-chain` enabled.
> - B) No; disable those three Effect-specific rules.
> - C) Adopting Effect now; keep them enabled as aspirational guardrails.

Second, about the database layer:

> Does this project use a typed query builder (Kysely, Drizzle, Prisma's typed client)?
> - A) Yes; keep `no-raw-sql` enabled.
> - B) No; disable `no-raw-sql`.
> - C) No database in this project. Leave the rule on; it will never fire.

Regardless of the answers, these four rules stay on: `bare-catch`, `record-cast`, `no-manual-enum-cast`, `no-hardcoded-secrets`.

### Step 4b: Ask about testing dependencies

Testing is a craft dimension of the principles, not a separate modality. Principle 1's corollary: *tests exist for constraints the type system could not encode.* The right test shape depends on what the code does. This step installs the libraries that match the shapes this repo actually has, and records the choices in the setup log.

Ask four `AskUserQuestion` prompts, in order. Record each answer (A/B/C) and the resulting install command (or "skipped") for the Step 11 receipt.

**Question 1 — fast-check (always recommended).**

> `fast-check` is the TypeScript property-based tester. It is the default tool when a function has a nameable algebraic property (roundtrip, idempotence, invariant, oracle agreement). Install as a dev dependency?
> - A) Yes, install now. (Recommended default.)
> - B) Skip; already installed or I will install later.

If A: `$PM add -D fast-check`. If B: record skipped.

**Question 2 — testcontainers-node (ask when DB/cache/queue present).**

Detect DB/cache/queue clients in `package.json` to pre-answer the prompt:

```bash
TC_HINT=""
for dep in pg postgres mysql2 mongodb redis ioredis kafkajs amqplib; do
  grep -q "\"$dep\"" package.json 2>/dev/null && TC_HINT="$TC_HINT $dep"
done
echo "TC_HINT:$TC_HINT"
```

> `testcontainers-node` runs a real Postgres/Redis/Kafka in Docker for integration tests (principle 2: mocks at the integration boundary are a lie). Detected clients:$TC_HINT. Install?
> - A) Yes, install `testcontainers` + `@testcontainers/postgresql` (or `-redis`, `-mongodb`, `-kafka` to match detected clients).
> - B) No; Docker is unavailable in CI, or I use a different harness.
> - C) No such dependency in this repo.

If A: install `testcontainers` plus the specific `@testcontainers/<service>` modules that match detected clients (one `$PM add -D` command). If B or C: record skipped.

**Question 3 — Stryker mutation testing (ask when critical modules exist).**

> Stryker runs mutation tests; `@stryker-mutator/typescript-checker` filters type-ill-formed mutants via `tsc` (direct synergy with principle 1). Recommended only for critical modules (auth, billing, parsing, crypto). Does this repo have such a module?
> - A) Yes; install `@stryker-mutator/core` + `@stryker-mutator/typescript-checker` and I will scope it to a glob later.
> - B) No; skip.
> - C) Already installed.

If A: `$PM add -D @stryker-mutator/core @stryker-mutator/typescript-checker`. If B or C: record skipped.

**Question 4 — Playwright (ask when a critical UI flow exists).**

> Playwright runs end-to-end browser tests. Recommended only for critical UI flows (signup, checkout, main workflow). Does this repo own such a flow?
> - A) Yes; install `@playwright/test`.
> - B) No UI, or UI is tested elsewhere; skip.
> - C) Already installed.

If A: `$PM add -D @playwright/test`. If B or C: record skipped.

**Record.** Carry the four answers into the Step 11 receipt under a `Testing deps:` line. Every answer is either an install command that ran, or the word `skipped`.

**Anti-patterns.**
- *"I'll install all four to save the user a step."* No. Stryker and Playwright have real install-time cost (browsers, mutation engine) and are opt-in.
- *"I'll skip fast-check if the user does not ask."* No. fast-check is the default; the prompt exists so the user can override, not so you can omit.
- *"I'll pick `@testcontainers/postgresql` without detecting."* No. Install only the modules that match detected clients.

### Step 5: Plan the configuration shape

You will write `eslint.config.js` once, in Step 7, after Step 6 installs the companion rules. Hold the shape in your head for now.

**Block 1: application source.** Spreads `guard.configs.recommended.rules`, adds stack disables from Step 4 answers, adds the companion rules from Step 6.

Stack disables for Block 1:

```js
// Included when the project is NOT on Effect (Step 4 answer B).
"safer-by-default/async-keyword": "off",
"safer-by-default/promise-type":  "off",
"safer-by-default/then-chain":    "off",
```

```js
// Included when the project has NO typed query builder (Step 4 answer B).
"safer-by-default/no-raw-sql": "off",
```

**Block 2: integration tests.** Uses `guard.configs.integrationTests.rules`, scoped to the glob from Step 3. Omit entirely if Step 3 answer was D.

**Block 3: require-description everywhere.** Enables `eslint-comments/require-description` across every `.ts` file, so every `eslint-disable` carries a written reason.

### Step 6: Install companion rules

One command:

```bash
$PM add -D @eslint-community/eslint-plugin-eslint-comments @typescript-eslint/eslint-plugin eslint-plugin-sonarjs
```

Rules to enable in Block 1 alongside the spread:

- `"@typescript-eslint/no-magic-numbers": "warn"`
- `"@typescript-eslint/no-unused-vars": "error"`
- `"sonarjs/no-duplicate-string": ["warn", { "threshold": 4 }]`

If any of these are already configured in the user's existing eslint config, skip the duplicates.

### Step 7: Write `eslint.config.js`

Check `IS_ESM` from Step 0. The config uses ESM `import` syntax. If the project is CommonJS (`IS_ESM=no`), save as `eslint.config.mjs` instead; announce the choice.

If an existing `FLAT_CONFIG` is present on the B (reconfigure) branch from Step 0a, show the diff to the user and confirm before writing.

The final shape:

```js
import guard from "eslint-plugin-agent-code-guard";
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
      "agent-code-guard": guard,
      "@typescript-eslint": tseslint,
      sonarjs,
    },
    rules: {
      ...guard.configs.recommended.rules,
      // Step 4 stack disables inserted here if applicable.
      "@typescript-eslint/no-magic-numbers": "warn",
      "@typescript-eslint/no-unused-vars": "error",
      "sonarjs/no-duplicate-string": ["warn", { threshold: 4 }],
    },
  },

  // Block 2: integration tests. Omit this block entirely if Step 3 said "none."
  {
    files: ["<GLOB FROM STEP 3>"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "agent-code-guard": guard },
    rules: guard.configs.integrationTests.rules,
  },

  // Block 3: require-description on every .ts file.
  {
    files: ["**/*.ts"],
    plugins: { "eslint-comments": comments },
    rules: {
      "eslint-comments/require-description": ["error", { ignore: [] }],
    },
  },
];
```

### Step 8: Flip `tsconfig.json` strict flags

Before changing anything, capture the pre-strict error count so the delta is honest:

```bash
$PM exec tsc --noEmit 2>&1 | tee /tmp/safer-tsc-before.txt | grep -cE "error TS" || echo "0" > /tmp/safer-tsc-before-count
TSC_BEFORE=$(grep -cE "error TS" /tmp/safer-tsc-before.txt 2>/dev/null || echo "0")
echo "TSC errors before: $TSC_BEFORE"
```

Then set the five flags under `compilerOptions` in `tsconfig.json`. Leave already-correct values alone; add only the missing ones:

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

```bash
$PM exec tsc --noEmit 2>&1 | tee /tmp/safer-tsc-after.txt | grep -cE "error TS" || echo "0"
TSC_AFTER=$(grep -cE "error TS" /tmp/safer-tsc-after.txt 2>/dev/null || echo "0")
echo "TSC errors after: $TSC_AFTER"
```

Report the delta as "N before, M after." If one flag is responsible for most of the new errors (visible in the error codes in `/tmp/safer-tsc-after.txt`), say which, and offer to turn just that one flag off while leaving the other four on. Do not silently back out a flag. Surface the tradeoff; the user decides.

### Step 9: Probe that the plugin actually fires

This is the proof step. Before reporting any lint baseline, write a file with a known anti-pattern, run ESLint, and confirm the expected rule appears in the output.

The probe file must sit under one of the `files:` globs from the config (usually `src/`). ESLint 9 refuses to lint files outside the project base path.

```bash
mkdir -p src
cat > src/__safer_probe__.ts <<'EOF'
// Probe file for /safer:setup verification. Deleted immediately after the check.
try { 1; } catch {}
EOF

$PM exec eslint --format json src/__safer_probe__.ts > /tmp/safer-probe-out.json 2>/tmp/safer-probe-err.txt
PROBE_EXIT=$?

rm -f src/__safer_probe__.ts

# Exit 0 = rule did not fire (bad). Exit 1 = lint errors (expected). Exit 2 = config broken (bad).
if [ "$PROBE_EXIT" = "2" ]; then
  echo "PROBE:failed. eslint config is broken:"
  cat /tmp/safer-probe-err.txt
elif grep -q '"ruleId":"safer-by-default/bare-catch"' /tmp/safer-probe-out.json 2>/dev/null; then
  echo "PROBE:passed"
else
  echo "PROBE:failed. bare-catch did not fire on a probe file that should trigger it."
  cat /tmp/safer-probe-out.json
  cat /tmp/safer-probe-err.txt
fi
```

If `PROBE:passed`, the plugin is live; proceed to Step 10.

If `PROBE:failed`, stop. Surface stderr and the JSON output. Do not run a baseline on a broken config; the numbers would be a lie. Common causes:

- `package.json` lacks `"type": "module"` and the config uses ESM syntax. Rename the file to `eslint.config.mjs` or add the field.
- The probe file path does not match any `files:` glob. Adjust the glob or the probe location.
- A peer dependency is out of range and the plugin does not load. Upgrade ESLint or TypeScript.

### Step 10: Run the full lint and report the baseline

With the probe green, lint the whole project. Do not defer to the user's existing `lint` script; `"lint": "eslint src"` often misses tests, and the baseline wants full coverage.

```bash
$PM exec eslint . 2>&1 | tee /tmp/safer-lint-full.txt | tail -40
```

Tabulate violations by rule. Present as a table:

| Rule | Violations |
|---|---|
| `safer-by-default/bare-catch` | 3 |
| `safer-by-default/no-hardcoded-secrets` | 1 |
| ... | ... |

Ask via `AskUserQuestion`:

> The baseline is N violations across M rules. How would you like to handle them?
> - A) Fix now, rule by rule, in this session. I rewrite offending code to pass.
> - B) Freeze the current state. I save per-rule counts to `.safer-baseline.json` for you to commit; CI fails only when the count rises.
> - C) Fix some specific rules now; defer the rest. I list the rules; you pick.
> - D) Accept as-is. No action; you fix violations as you touch the code.

If B: write `.safer-baseline.json` at the repo root with the per-rule counts. Do not `git add` or `git commit` on the user's behalf. Tell them the file exists.

Some fixes change runtime behavior as well as type shape; rewriting `async` into `Effect.gen` is not a mechanical transform. Never mass-fix silently. The four options exist so the user opts into the grade of change they want.

### Step 11: Print the completion summary

End with a bordered block naming every decision and outcome. This is the user's receipt:

```
============================================================
  /safer:setup complete.
============================================================
  Package manager:        <pm>
  Plugin version:         X.Y.Z
  eslint.config.(js|mjs): written (three blocks) | skipped
  Integration glob:       <from Step 3 | "skipped">
  Effect rules:           on | off
  Kysely rules:           on | off
  Companion rules:        no-magic-numbers, no-unused-vars, no-duplicate-string
  Testing deps:           fast-check=<installed|skipped>
                          testcontainers=<installed <modules>|skipped>
                          stryker=<installed|skipped>
                          playwright=<installed|skipped>
  tsconfig strict:        N errors before, M errors after
  Probe:                  passed
  Lint baseline:          V violations across R rules
  Baseline decision:      A | B | C | D  (per Step 10)
  Baseline file:          .safer-baseline.json | not written
============================================================
```

Then emit the end telemetry:

```bash
safer-telemetry-log --event-type safer.skill_end --modality setup \
  --session "$SESSION" --outcome success \
  --duration-s "$(($(date +%s) - _TEL_START))" 2>/dev/null || true
```

Tell the user:

> `/safer:typescript` applies in context whenever you or another agent writes or reviews TypeScript in this repo. You do not need to invoke it. To re-run this setup (new stack, moved integration tests), run `/safer:setup` again; it detects the existing state and does only what is necessary.

## Stop rules

`setup` is interactive. It asks via `AskUserQuestion` rather than escalating. Three cases end the skill early:

1. **Probe failed.** `bare-catch` did not fire on the probe file. Do not report a baseline on broken config. Surface stderr; report `BLOCKED`; tell the user what to check.
2. **Peer dependency out of range and cannot be upgraded.** `eslint` stuck below 9 or `typescript` stuck below 5. Report `BLOCKED` with the specific version.
3. **User chose "walk away"** on the already-installed branch, or rejected the reconfigure diff. Report `DONE` with no changes; print the one-line summary.

This skill does not produce a `safer-escalate` artifact. Local-only; no GitHub publication.

## Completion status

One marker on the last line of the reply.

- `DONE` ; setup completed or walked away cleanly; summary printed.
- `DONE_WITH_CONCERNS` ; setup completed, but at least one subsystem flagged concerns (for example: tsconfig strict produced many new errors and the user deferred fixing them).
- `BLOCKED` ; probe failed, or peer dependency cannot be upgraded, or a tool required to run a step is missing.
- `NEEDS_CONTEXT` ; ambiguity the user must resolve (for example: monorepo with per-package configs that this skill does not handle).

`ESCALATED` does not apply here (no upstream modality to escalate to; setup is user-invoked).

## Publication map

| Artifact | Destination | Committed? |
|---|---|---|
| `eslint.config.js` or `eslint.config.mjs` | Repo root | User decides |
| `tsconfig.json` edits | In place | User decides |
| `package.json` dependency changes | In place via `<pm> add -D` | User decides (the lockfile changes too) |
| `.safer-baseline.json` | Repo root (only if baseline option B chosen) | User decides |
| Completion summary | Terminal output only | not applicable |

This skill never commits. `git add` and `git commit` are the user's decision.

## Anti-patterns

- **"I will commit the config for the user; they are about to anyway."** No. Installing is routine; committing is not. Leave git alone.
- **"The probe nearly fired; close enough, I will report the baseline."** No. The probe is binary. Broken probe means broken config means false baseline.
- **"I will mass-fix the baseline violations to save the user a step."** No. Some rules require semantic rewrites. The Step 10 question exists for a reason.
- **"The user has a legacy `.eslintrc`; I will migrate it quickly."** No. Flat config migration is a separate decision. Tell the user; stop.
- **"I defaulted to pnpm silently."** No. If the lockfile is ambiguous, announce the default and give the user a chance to override.
- **"tsconfig produced 400 new errors; I will back out `noUncheckedIndexedAccess`."** No. Surface the count; name the flag; let the user decide.
- **"I will skip the probe in CI-like environments."** No. The probe is what makes the baseline trustworthy.

## Checklist before declaring `DONE`

- [ ] Step 0 detection output is visible to the user.
- [ ] Package manager was detected or defaulted with announcement.
- [ ] Peer dependencies (`eslint >= 9`, `typescript >= 5`) are satisfied.
- [ ] Plugin and parser are installed.
- [ ] Integration-tests glob is decided.
- [ ] Stack questions (Effect, query builder) are answered.
- [ ] Testing-deps questions (fast-check, testcontainers, Stryker, Playwright) are answered; each resolves to an install command or `skipped`.
- [ ] Companion rules are installed.
- [ ] `eslint.config.(js|mjs)` is written (or explicitly skipped on the already-installed branch).
- [ ] Five tsconfig strict flags are set; pre and post error counts are reported.
- [ ] Probe passed.
- [ ] Full lint ran; per-rule table shown to user.
- [ ] Baseline decision (A / B / C / D) is recorded; any resulting `.safer-baseline.json` is on disk.
- [ ] Completion summary block is printed.
- [ ] `safer.skill_end` event emitted.
- [ ] Status marker on the last line of the reply.

If any box is unchecked, the status is not `DONE`.

## Voice (reminder)

See `PRINCIPLES.md` voice section. Setup is high-traffic and interactive. Show the user exactly what you are about to do before doing it. Use `AskUserQuestion` for every decision that is not inferable from disk. Numbers over adjectives: "47 errors before, 112 after", not "some new errors." End with the receipt block and the status marker.

The next agent touching this repo reads `eslint.config.js` and `tsconfig.json`, not this session. Make those two files speak clearly.
