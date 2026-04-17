---
name: safer-by-default
version: 0.1.0
description: |
  Agent-facing coding discipline. Default to the high-safety idioms that
  humans skip because of friction. Strong types, schemas at boundaries,
  typed errors, exhaustive handlers, Effect. Agents have no friction cost
  for ceremony, so the "not worth it for MVP" excuse is dead. Invoke when
  starting a new repo, reviewing a plan, or before writing non-trivial code.
  Companion to eslint-plugin-agent-code-guard.
allowed-tools:
  - Read
  - Grep
  - Glob
---

# /safer-by-default

## When this skill is invoked

Your first responsibility, before anything else, is to check whether this repo is set up. Run through the [Setup checklist](#setup-checklist). If the plugin is already wired, skip to the principles and apply them to whatever the user is working on.

Humans don't run setup steps by hand. You do.

## Setup checklist

Run this on a fresh repo, or any repo where `eslint-plugin-agent-code-guard` isn't yet installed or wired. Confirm with the user at each major step and don't guess past ambiguity.

### 1. Detect the package manager

Check in order: `pnpm-lock.yaml` → pnpm, `package-lock.json` → npm, `yarn.lock` → yarn. If none, ask the user which to use.

### 2. Check peer deps

- `eslint >= 9` (flat config). If below 9, ask the user to upgrade first — this plugin does not support legacy `.eslintrc` configs.
- `typescript >= 5`.

### 3. Install the plugin and parser

```sh
<pm> add -D eslint-plugin-agent-code-guard @typescript-eslint/parser
```

### 4. Wire `eslint.config.js`

Create or update `eslint.config.js` with the two-block setup — application source under `recommended`, integration tests under `integrationTests`. Ask the user for their integration-test glob before writing the config. Do not assume `**/*.integration.test.ts`; their tests may be under `tests/integration/**` or similar.

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

### 5. Adjust rules to the user's stack

Ask two questions before proceeding:

- **Effect?** If the user's project does not use Effect, disable `async-keyword`, `promise-type`, and `then-chain` in the application-source block. Don't suppress per-callsite — turn them off at the preset level.
- **Kysely or Drizzle?** If the user's project has no typed query builder, disable `no-raw-sql`. Note that raw SQL without a typed builder will stay a weak spot regardless.

Always keep these on: `bare-catch`, `record-cast`, `no-manual-enum-cast`, `no-hardcoded-secrets`. They are stack-independent.

### 6. Install and wire `eslint-comments/require-description`

Every rule suppression must carry a written reason. Install and wire it:

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

### 7. Install companion rules if they aren't already

Skip any that are already on. Otherwise install:

```sh
<pm> add -D @typescript-eslint/eslint-plugin eslint-plugin-sonarjs
```

Enable these rules on the application-source block:

- `@typescript-eslint/no-magic-numbers`
- `@typescript-eslint/no-unused-vars`
- `sonarjs/no-duplicate-string`

### 8. Flip `tsconfig.json` strict flags

In the existing `tsconfig.json`, set these under `compilerOptions`. If any are already set, leave them. If any flag change breaks the existing codebase, surface the breakage — don't silently back out.

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

### 9. Run the lint and report the baseline

Run `<pm> eslint .` (or whatever the user's lint script is). Report how many violations exist. Ask the user:

- Fix now, rule by rule, in this session?
- Accept the baseline and only block new violations (add an `.eslintignore`-style carve-out, or commit the baseline report so the CI check compares against it)?
- Fix specific rules now and defer others?

Do not silently fix everything without asking. Some rule fixes (e.g. rewriting `async` → `Effect.gen`) touch behavior, not just style.

### 10. Activate this skill for future sessions (if not already)

If `.claude/skills/safer-by-default/SKILL.md` does not exist:

```sh
mkdir -p .claude/skills/safer-by-default
cp node_modules/eslint-plugin-agent-code-guard/SKILL.md .claude/skills/safer-by-default/SKILL.md
```

Commit `.claude/skills/safer-by-default/SKILL.md` so the skill travels with the repo.

---

## The core claim

Compilers took assembly from "careful humans writing bit patterns" to "type-checked high-level code." Compilers were slow, annoying, and expensive. Most assembly programmers skipped them. Then tooling made compilers near-free, and skipping them became unthinkable.

We are at the same inflection for AI agents and high-level code.

Strong types. Schemas at every boundary. Typed errors. Total functions. Exhaustive pattern matches. Property-based tests. These techniques eliminate entire classes of bugs before any runtime check. For humans they were "too much friction." Too much typing, too much ceremony, too much boilerplate to read. So humans bypassed linters, loosened tsconfig, cast things to unknown, threw untyped errors, and shipped.

Agents feel none of that friction. An agent writes two hundred lines of Effect with tagged errors as easily as twenty lines of async/await. The gstack compression table puts boilerplate at roughly one hundred times, tests at fifty times, features at thirty times. The ten percent of completeness that humans skipped because it was "not worth it for MVP" costs seconds when an agent writes it, and prevents hours of debugging later.

This skill tells the agent: default to the high-grade idioms. The MVP excuse is dead.

## Connection to Boil the Lake

Garry Tan's principle. Always do the complete thing when AI makes the marginal cost near-zero. A lake is boilable. One hundred percent test coverage for a module, full feature implementation, all edge cases, complete error paths. An ocean is not. Multi-quarter rewrites. Platform migrations. Boil lakes. Flag oceans.

Canonical essay: https://garryslist.org/posts/boil-the-ocean. Full principle lives in `~/.claude/skills/gstack/ETHOS.md`.

TypeScript code safety is a lake. Every concrete technique below is reachable in fifteen to sixty agent-minutes. Boil it.

## The principles

### 1. Completeness is cheap. Incomplete is expensive.

The full version of a feature costs minutes more than the shortcut when an agent writes it. All edge cases handled. Types that make bad states unrepresentable. Schemas at every boundary. Errors typed. Choose the full version every time.

"Ship the ninety percent" was the right call when human engineering hours were the bottleneck. They are not the bottleneck anymore.

### 2. Types beat tests.

A test catches a bug that already exists. A type makes the bug impossible to write.

Before adding a test, ask whether the constraint can live in the type system. Branded string types. Discriminated unions. Exhaustive switch with never. NonEmptyArray. Positive numbers. Literal unions.

Every constraint you push into the types is a test you do not have to write and a mistake the compiler catches before it ships.

### 3. Validate at every boundary.

Data from disk, network, environment variables, user input, dynamic imports, other packages. Never trust static types at a boundary. Decode with a schema and fail loudly when the shape is wrong.

Inside the boundary, your types are truths. Outside, they are wishes. Pick a schema library (Effect Schema, Zod, Valibot) and use it consistently at every edge.

### 4. Typed errors are not optional.

`throw new Error("something went wrong")` hides a fact that will cost hours later. Which call sites can this happen at. Which callers know how to handle it. What does the user see.

Tagged error classes or discriminated-union results make the error set part of the type. Untyped throw is the assembly-language way of doing error handling.

### 5. Refactor aggressively.

Agents refactor at thirty to one hundred times human speed. Awkward name? Rename. Wrong module boundary? Split. Two almost-identical functions? Merge.

The cost of the right refactor is minutes. The cost of living with the wrong structure compounds every future session, multiplied by every future developer.

### 6. Exhaustiveness over optionality.

Every switch over a union gets a default that assigns to never. Every if/else chain gets a final else that either handles or rejects. Every Option.match and Either.match handles both branches.

Never leave a branch as "probably not reached." Probably not reached becomes definitely not handled, and then definitely breaks at two in the morning.

### 7. Strict tsconfig is the floor.

All strict flags on, day one. `strict: true`. `noUncheckedIndexedAccess: true`. `exactOptionalPropertyTypes: true`. `noImplicitOverride: true`. `noFallthroughCasesInSwitch: true`.

Flipping these later means rewriting code that was written to slack rules. Flipping them first means the code was written correctly from the start. This is cheaper.

### 8. The next agent thanks you.

You are not the last agent to touch this code. Every type annotation, every schema, every tagged error you add is load-bearing context for the next session.

Dense untyped implicit code is illegible to agents the same way obfuscated code is illegible to humans. Self-documenting types are the agent-readable equivalent of good naming.

## Phrases to reject

These signal that a human shortcut is about to happen. Catch them in your own output or the user's request. Pause and rewrite.

"This is just a prototype."

"Not worth it for MVP."

"We'll add types / tests / validation later."

"Good enough for now."

"I'll just cast it to any / unknown / Record<string, unknown>."

"Let me just silence the linter for this one."

"The happy path is the important part."

"Users will pass the right shape, don't worry about malformed input."

"Don't over-engineer it."

When the user asks for a shortcut, surface the compression cost. Something like: *"That's a two-week-human / thirty-minute-agent task. The shortcut saves you about twenty-five minutes of agent time and costs you hours of debugging later. Want the full version?"* Then defer to user sovereignty if they still say skip.

## Decision rules for when to invest

| Scenario | Human-era shortcut | Agent-era full version |
|---|---|---|
| Parsing an API response | `(await r.json()) as Record<string, unknown>` | `Schema.decodeUnknown(Body)(await r.json())` |
| Function that can fail | `throw new Error("bad")` | `return yield* Effect.fail(new BadError({ cause }))` |
| String union type | `row.status as "a" \| "b" \| "c"` | Import generated Status union |
| Error in try/catch | `try { op() } catch {}` | `Effect.try({ try: op, catch: e => new OpError({ cause: e }) })` |
| Env var access | `process.env.FOO!` | Env schema parsed once at boot |
| Async return type | `async f(): Promise<T>` | `(): Effect.Effect<T, E, R> => Effect.gen(...)` |
| Identifier type | `string` | `UserId = string & { __brand: "UserId" }` |
| Switch over union | `case "a": ... case "b": ...` | Final case returns `absurd(x)` where `absurd(x: never): never` |
| Test coverage | Happy path only | Happy path, error paths, property test |

In every row, choose the full version. The compression math makes it roughly free, and the safety dividend compounds forever.

## The lake to boil

Every new TypeScript repo, day one.

`tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`.

`eslint-plugin-agent-code-guard` installed with the `recommended` and `integrationTests` presets wired up.

`@typescript-eslint/no-magic-numbers` and `sonarjs/no-duplicate-string` enabled.

`@eslint-community/eslint-plugin-eslint-comments` with `require-description` set to `"error"` so every rule suppression carries a reason.

Schema library wired in at every input and output boundary. Effect Schema or Zod. Pick one and use it everywhere.

Effect-style error channel for every fallible operation. Tagged error classes instead of raw throws.

Env vars validated with a schema at boot. After that, code never reads `process.env` directly.

Branded types for every identifier-like string. `UserId`, `OrgId`, `Email`, `Url`.

Discriminated unions for every state machine. An `absurd(x: never)` helper imported and used in exhaustive switches.

Property-based tests (e.g. `fast-check`) for any pure logic that takes a value and returns another.

Kysely or Drizzle for database access. Zero raw SQL.

Integration tests hit real dependencies. No `vi.mock` in `*.integration.test.ts`.

No secrets in source. All secrets loaded from the environment with a schema-validated shape.

Default posture is all twelve, day one. Adding them later costs roughly ten times the effort, because existing code is written to slack rules.

## Connection to the lint plugin

The plugin enforces the floor. If code trips any of its nine rules, it is below the floor. The agent fixes it rather than suppressing it without a written reason.

This skill describes the ceiling. What the code looks like when it is actively using the agent-era techniques, not just avoiding the forbidden ones.

Rule to principle mapping:

`async-keyword`, `promise-type`, `then-chain` follow from principle four (typed errors).

`bare-catch` follows from principles four and six (typed errors, exhaustiveness).

`record-cast` and `no-manual-enum-cast` follow from principles three and two (validate at boundaries, types beat tests).

`no-raw-sql` follows from principles two and three (types over runtime checks, validated boundaries).

`no-vitest-mocks` follows from integration-test integrity. Real boundaries, not fictional ones.

`no-hardcoded-secrets` follows from principle three. Env is a boundary, validate at boot.

Per-rule before-and-after examples live at `node_modules/eslint-plugin-agent-code-guard/docs/rules/<rule-name>.md`. Agents read the relevant doc before attempting a fix.

## User sovereignty still wins

The user can always say "skip it, we ship tomorrow." Comply. But.

Name exactly what is being skipped. "We are shipping without the env schema. `process.env.STRIPE_KEY!` will 500 at runtime if missing."

Add a TODO referencing this skill so the next agent sees the debt.

Never silently skip. Every shortcut is explicit, named, and attributed.

## When to invoke

User runs `/safer-by-default` explicitly. First action: run the [Setup checklist](#setup-checklist) unless the repo is already wired.

Starting a new TypeScript repo. Use the setup checklist, then the lake checklist.

Reviewing a plan that describes code changes. Score each decision against the principles.

Before writing a chunk of non-trivial code. Pick the full-version option for each decision listed.

When the user or the agent says any rejected phrase. Pause. Present the compression math.

## When not to invoke

Pure refactors that preserve behavior. The existing code's discipline is out of scope.

Scripts with a single-use lifetime. One-shot data migrations, CI glue. The compression math flips here. No future agent will read this code.

Debugging sessions where the goal is to find a bug, not ship new code. Apply the principles after the bug is understood.

## Closing

The human era said: be pragmatic, ship it, iterate. That was correct when engineering time was the bottleneck.

The agent era says: be complete, ship it, and the next agent thanks you. The bottleneck moved.

Write code that reflects where the bottleneck is now.
