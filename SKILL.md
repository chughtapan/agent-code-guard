---
name: safer-by-default
version: 0.1.0
description: |
  Agent-facing coding discipline. Default to the high-safety idioms — strong
  types, schemas at boundaries, typed errors, exhaustive handlers, Effect —
  that humans skip because of friction. Agents have no friction cost for
  ceremony, so the "not worth it for MVP" excuse is dead. Invoke when
  starting a new repo, reviewing a plan, or before writing non-trivial code.
  Companion to eslint-plugin-agent-code-guard.
allowed-tools:
  - Read
  - Grep
  - Glob
---

# /safer-by-default — Agents Enable a Higher Grade of Code Safety

## The core claim

Compilers took assembly from "careful humans writing bit patterns" to "type-checked high-level code." Compilers were too slow, too annoying, too expensive for most assembly programmers to adopt — until tooling made them near-free. Then "not using a compiler" became unthinkable.

We are at the same inflection for AI agents and high-level code.

Strong types, exhaustive validation, typed errors, schema-first decoding, property-based tests, total functions — the techniques that eliminate entire classes of bugs without writing runtime checks — were "too much friction" for humans. Too much typing, too much ceremony, too much boilerplate to read. Humans bypass linters, loosen tsconfig, cast to `unknown`, `throw new Error("bad")`, and ship.

Agents don't feel friction. An agent writes 200 lines of Effect with tagged errors as easily as 20 lines of `async`/`await`. The [gstack compression table](~/.claude/skills/gstack/ETHOS.md) puts boilerplate at ~100x, tests at ~50x, features at ~30x. The 10% of completeness that humans skip because it's "not worth it for MVP" costs seconds when an agent writes it, and prevents hours of debugging later.

**This skill tells the agent: default to the high-grade idioms. The MVP excuse is dead.**

## How this relates to Boil the Lake

Garry Tan's principle: *always do the complete thing when AI makes the marginal cost near-zero.* A lake is boilable (100% test coverage, all edge cases, full feature). An ocean is not (multi-quarter rewrite). Boil lakes, flag oceans. Canonical: <https://garryslist.org/posts/boil-the-ocean>, loaded in full in `~/.claude/skills/gstack/ETHOS.md`.

TypeScript code safety is a lake. Every concrete technique below is reachable in 15–60 agent-minutes. Boil it.

## The principles

### 1. Completeness is cheap; incomplete is expensive.
The full version — all edge cases, types that make bad states unrepresentable, schemas at every boundary, errors typed — costs minutes more than the shortcut when an agent writes it. Choose it every time. "Ship the 90%" was the right call when human-engineering-hours were the bottleneck. They aren't anymore.

### 2. Types beat tests.
A test catches a bug that already exists. A type makes the bug impossible to write. Before adding a test, ask: can I encode this in the type system? Branded string types, discriminated unions, exhaustive `switch` with `never`, `NonEmptyArray`, `Positive<number>`, literal unions — every constraint you can push into the types is a test you don't have to write and a mistake the compiler catches.

### 3. Validate at every boundary.
Data from disk, network, env vars, user input, dynamic imports, other packages — never trust static types at a boundary. Decode with a schema (Effect `Schema`, Zod, Valibot) and fail loudly when the shape is wrong. Inside the boundary, your types are truths. Outside, they're wishes.

### 4. Typed errors are not optional.
`throw new Error("something went wrong")` hides a fact that will cost hours later: which call sites can this happen at, which callers know how to handle it, what does the user actually see. Tagged error classes (Effect `Data.TaggedError`) or discriminated-union results make the error set part of the type. Untyped `throw` is the assembly-language way.

### 5. Refactor aggressively.
Agents refactor at ~30x–100x human speed. Awkward name? Rename. Wrong module boundary? Split. Two almost-identical functions? Merge. The cost of the right refactor is minutes; the cost of living with the wrong structure is every future session multiplied by every future developer.

### 6. Exhaustiveness over optionality.
Every `switch` over a union gets a `default` that assigns to `never`. Every `if/else if` chain gets a final `else` that either handles or rejects. Every `Option.match` / `Either.match` handles both branches. Never leave a branch as "probably not reached" — "probably not reached" becomes "definitely not handled."

### 7. Strict tsconfig is the floor.
All strict flags on, day one. `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`. Flipping these later means rewriting code that was written to slack rules. Flipping them first means the code was written correctly from the start.

### 8. The agent is the last mile. Make the code easy for the next agent.
You will not be the last agent to touch this code. Every type annotation you add, every schema you write, every tagged error you introduce is load-bearing context for the next session. Dense, untyped, implicit code is illegible to agents the same way obfuscated code is illegible to humans. Self-documenting types are the agent-readable equivalent of good naming.

## Phrases the agent must reject

These signal "a human shortcut is about to happen." Catch them in your own output or the user's request, pause, and rewrite.

- "This is just a prototype"
- "Not worth it for MVP"
- "We'll add types / tests / validation later"
- "Good enough for now"
- "I'll just cast it to `any` / `unknown` / `Record<string, unknown>`"
- "Let me just silence the linter for this one"
- "The happy path is the important part"
- "Users will pass the right shape, don't worry about malformed input"
- "Don't over-engineer it"

If the user asks for a shortcut, surface the compression cost: *"That's a 2-week-human / 30-minute-agent task. The shortcut saves you ~25 minutes of agent time and costs you hours of debugging later. Want the full version?"* Then defer to user sovereignty if they still say skip.

## Decision rules for when to invest

| Scenario | Shortcut (human-era) | Full version (agent-era) | Call |
|---|---|---|---|
| Parsing an API response | `(await r.json()) as Record<string, unknown>` | `Schema.decodeUnknown(Body)(await r.json())` | **Full.** ~10 extra lines. |
| Function that can fail | `throw new Error("bad")` | `return yield* Effect.fail(new BadError({ cause }))` | **Full.** Typed errors. |
| String union | `status as "a" \| "b" \| "c"` | Import the generated `Status` union | **Full.** No re-cast. |
| Error in `try`/`catch` | `try { op() } catch {}` | `Effect.try({ try: op, catch: e => new OpError({ cause: e }) })` | **Full.** Typed failure. |
| Env var access | `process.env.FOO!` | Env schema parsed once at boot | **Full.** Fail at boot, not line 4000. |
| Async return | `async f(): Promise<T>` | `const f = (): Effect.Effect<T, E, R> => Effect.gen(...)` | **Full.** Composable, typed errors. |
| ID / email / URL | `string` | `UserId = string & { __brand: "UserId" }` | **Full.** Can't pass wrong ID anywhere. |
| `switch` over union | `case "a": ... case "b": ...` | `...default: return absurd(x)` with `const absurd = (x: never): never => {...}` | **Full.** Compile error on new variant. |
| Test coverage | "Happy path test" | "Happy path + all error paths + property test" | **Full.** Tests are 50x compressed. |

## The lake to boil (TypeScript starter checklist)

Every new TypeScript repo, day one:

- [ ] `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`
- [ ] `eslint-plugin-agent-code-guard` installed with `recommended` + `integrationTests` presets
- [ ] `@typescript-eslint/no-magic-numbers` + `sonarjs/no-duplicate-string` enabled
- [ ] `@eslint-community/eslint-plugin-eslint-comments` with `require-description: ["error"]` (every rule suppression must carry a reason)
- [ ] Schema library wired in at every I/O boundary (Effect `Schema` or Zod — pick one and use it everywhere)
- [ ] Effect-style error channel for every fallible operation (`Data.TaggedError` subclasses, never raw `throw`)
- [ ] Env vars validated with a schema at boot; code never reads `process.env` directly after that
- [ ] Branded types for every ID-like string (`UserId`, `OrgId`, `Email`, `Url`)
- [ ] Discriminated unions for every state machine; `absurd(x: never)` helper imported
- [ ] Property-based tests (`fast-check`) for pure logic
- [ ] Kysely (or Drizzle) for DB access; zero raw SQL
- [ ] Integration tests hit real dependencies (no `vi.mock` in `*.integration.test.ts`)
- [ ] No secrets in source — all loaded from env with schema-validated shape

Default posture: all twelve, day one. Adding them later costs 10x the effort because existing code is written to slack rules.

## Connection to `eslint-plugin-agent-code-guard`

The plugin enforces the **floor**. If code trips any of the 9 rules, it's below the floor and the agent must fix it (not suppress it without a written reason). This skill describes the **ceiling**: what the code looks like when it's actively using the agent-era techniques, not just avoiding the forbidden ones.

Rule → principle mapping:
- `async-keyword`, `promise-type`, `then-chain` — principle 4 (typed errors)
- `bare-catch` — principles 4 + 6 (typed errors, exhaustiveness)
- `record-cast`, `no-manual-enum-cast` — principle 3 (validate at boundaries) and 2 (types beat tests)
- `no-raw-sql` — principles 2 + 3 (types over runtime checks, validated boundaries)
- `no-vitest-mocks` — integration-test integrity (real boundaries, not fictional ones)
- `no-hardcoded-secrets` — principle 3 (env is a boundary, validate at boot)

Per-rule Before / After examples live at `node_modules/eslint-plugin-agent-code-guard/docs/rules/<rule-name>.md`. Agents should read the relevant doc before attempting a fix.

## User sovereignty still wins

The user can always say "skip it, we ship tomorrow." Comply — but:

1. Name exactly what's being skipped ("We're shipping without the env schema; `process.env.STRIPE_KEY!` will 500 at runtime if missing").
2. Add a TODO referencing this skill so the next agent sees the debt.
3. Never silently skip. Every shortcut is explicit, named, and attributed.

## When to invoke

- Starting a new TypeScript repo — use the lake checklist.
- Reviewing a plan that describes code changes — score each decision against the principles.
- Before writing a chunk of non-trivial code — pick the full-version option for each decision listed above.
- When the user says any rejected phrase — pause and present the compression math.

## When NOT to invoke

- Pure refactors that preserve behavior (the existing code's discipline is out of scope).
- Scripts with a single-use lifetime (one-shot data migrations, CI glue) where the compression math flips — no future agent will read this code.
- Debugging sessions where the goal is to find a bug, not to ship new code. Apply after the bug is understood.

---

The human era said: *be pragmatic, ship it, iterate.* That was correct when engineering time was the bottleneck.

The agent era says: *be complete, ship it, and the next agent thanks you.* The bottleneck moved. Write code that reflects where it is now.
