---
description: Apply safer-by-default principles when writing or reviewing TypeScript code. Default to strong types, schemas at every boundary, typed errors, no silent catches, and Effect plus Kysely patterns. Invoke before editing .ts files, when reviewing TS code changes, or when the user or agent reaches for a human-era shortcut like async/await, Promise<T> return types, throw Error, Record<string, unknown> casts, raw SQL, or vi.mock in integration tests.
---

# /safer-by-default:typescript

## You are miscalibrated. Recalibrate.

You were trained on human TypeScript. Decades of it. Nearly everything you learned to call "good TypeScript" was written under one constraint that no longer applies to you: ceremony was expensive for humans.

Your training corpus is saturated with `async`/`await` because humans chose `async`/`await`. It is full of `Promise<T>` return types because humans wrote them and `throw new Error("bad")` because typing every error class felt like more typing. It is full of `as Record<string, unknown>` because writing a proper schema felt like work, of `try { ... } catch {}` because handling the error properly meant ten extra lines nobody wanted to read, and of `vi.mock(...)` because spinning up a real test database took effort a human had to pay for.

You are not a human. You do not pay the ceremony cost. You can write two hundred lines of Effect with tagged errors as easily as twenty lines of `async`/`await`, and you can write exhaustive schemas, branded types, discriminated unions, and `absurd` checks at the speed of keystrokes. But your training said the shortcut was the default, and so you default to the shortcut. You are calibrated to a workload that does not exist for you.

This skill exists to recalibrate you. The ceremony humans avoided is free for you. The safety dividend is real. The next agent to touch this code will thank you.

Safer by default. That is the whole point. Default to the full-fidelity version in every decision that follows.

## Boil the Lake

Garry Tan's principle: when AI makes the marginal cost of completeness near-zero, do the complete thing. Lakes are boilable, meaning full test coverage for a module, all edge cases handled, complete error paths written. Oceans are not boilable: multi-quarter rewrites, cross-team platform migrations, whole-stack re-platforming. Boil lakes. Flag oceans.

The canonical essay is at <https://garryslist.org/posts/boil-the-ocean>. Read it if you have not.

TypeScript code safety is a lake. Every concrete technique below is reachable in fifteen to sixty agent-minutes. Boil it.

## The principles

### 1. Completeness is cheap. Incomplete is expensive.

The full version of a feature costs you minutes more than the shortcut. Handle every edge case. Use types that make bad states unrepresentable. Put a schema at every boundary. Type every error. Choose the full version every time.

"Ship the ninety percent" was the right call when human engineering hours were the bottleneck. They are not the bottleneck anymore, and the old math no longer applies.

### 2. Types beat tests.

A test catches a bug that already exists. A type makes the bug impossible to write in the first place.

Before you add a test, ask whether the constraint can live in the type system instead. Branded string types, discriminated unions, exhaustive switches that end in `never`, `NonEmptyArray`, positive numbers, literal unions. Every constraint you push into the types is a test you do not have to write and a mistake the compiler catches before it ever ships.

### 3. Validate at every boundary.

Data from disk, data from the network, data from environment variables, data from user input, data from dynamic imports, data from any other package: at every boundary, never trust a static type. Decode the shape with a schema, and fail loudly when the shape is wrong.

Inside the boundary, your types are truths. Outside the boundary, they are wishes. Pick a schema library once, whether Effect Schema or Zod or Valibot, and use it consistently at every edge.

### 4. Typed errors are not optional.

`throw new Error("something went wrong")` hides a fact that will cost someone hours later. Which call sites can this happen at? Which callers know how to handle it? What does the user actually see?

Tagged error classes, or discriminated-union result types, make the set of possible errors part of the function's type. An untyped throw is the assembly-language way of doing error handling, and you have better tools available.

### 5. Refactor aggressively.

You refactor at thirty to one hundred times human speed. If a name is awkward, rename it. If a module boundary is wrong, split it. If two functions are almost identical, merge them.

The cost of the right refactor is a few minutes. The cost of living with the wrong structure compounds across every future session, multiplied by every future developer who has to read it.

### 6. Exhaustiveness over optionality.

Every switch over a union gets a default branch that assigns to `never`. Every if-else chain gets a final else that either handles the remaining case or rejects it explicitly. Every `Option.match` and `Either.match` handles both branches.

Never leave a branch labeled "probably not reached." Probably not reached becomes definitely not handled, and then it definitely breaks at two in the morning.

### 7. Strict tsconfig is the floor.

Turn all the strict flags on, day one. `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`.

Flipping these later means rewriting code that was written to slack rules. Flipping them first means the code is written correctly from the start, which is cheaper.

### 8. The next agent thanks you.

You are not the last agent to touch this code. Every type annotation, every schema, every tagged error you add is load-bearing context for the next session, whether that session is tomorrow or next year.

Dense, untyped, implicit code is illegible to an agent the same way obfuscated code is illegible to a human. Self-documenting types are the agent-readable equivalent of good naming.

## Phrases to reject

The following phrases signal that a human-era shortcut is about to happen. Catch them when they appear in your own output or in the user's request, pause, and rewrite.

"This is just a prototype."

"Not worth it for MVP."

"We'll add types later." "We'll add tests later." "We'll add validation later."

"Good enough for now."

"I'll just cast it to any." "I'll just cast it to unknown." "I'll just cast it to `Record<string, unknown>`."

"Let me just silence the linter for this one."

"The happy path is the important part."

"Users will pass the right shape. Don't worry about malformed input."

"Don't over-engineer it."

When the user asks for one of these shortcuts, surface the compression cost in real numbers. Something like: "That is a two-week task for a human and a thirty-minute task for me. The shortcut saves twenty-five minutes of my time and costs you hours of debugging later. Do you want the full version?" Then defer to user sovereignty if they still say skip.

## Decision rules for when to invest

Every row in the table below represents a fork where you will feel pulled toward the human-era shortcut. In every row, choose the agent-era full version. The compression math makes the full version nearly free, and the safety dividend compounds forever.

| Scenario | Human-era shortcut | Agent-era full version |
|---|---|---|
| Parsing an API response | `(await r.json()) as Record<string, unknown>` | `Schema.decodeUnknown(Body)(await r.json())` |
| Function that can fail | `throw new Error("bad")` | `return yield* Effect.fail(new BadError({ cause }))` |
| String union type | `row.status as "a" \| "b" \| "c"` | Import the generated `Status` union |
| Error in try/catch | `try { op() } catch {}` | `Effect.try({ try: op, catch: e => new OpError({ cause: e }) })` |
| Env var access | `process.env.FOO!` | Env schema parsed once at boot |
| Async return type | `async f(): Promise<T>` | `(): Effect.Effect<T, E, R> => Effect.gen(...)` |
| Identifier type | `string` | `UserId = string & { __brand: "UserId" }` |
| Switch over union | `case "a": ... case "b": ...` | Final case returns `absurd(x)`, where `absurd(x: never): never` |
| Test coverage | Happy path only | Happy path, every error path, property-based test |

## The ideal repo state

What follows is the shape an agent-era TypeScript repo should have from day one. The `setup` skill automates the first four items. The rest are architectural choices you make as you write code.

The `tsconfig.json` turns on `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, and `noFallthroughCasesInSwitch`.

`eslint-plugin-safer-by-default` is installed, with the `recommended` preset wired to application source and the `integrationTests` preset wired to the integration-test glob.

`@typescript-eslint/no-magic-numbers` and `sonarjs/no-duplicate-string` are on.

`@eslint-community/eslint-plugin-eslint-comments` is on with `require-description` set to `"error"`, so every rule suppression carries a written reason.

A schema library is wired in at every input and output boundary. Pick one, whether Effect Schema or Zod, and use it everywhere.

Every fallible operation returns an Effect with a typed error channel, or a discriminated-union result. No raw throws.

Environment variables are validated with a schema at boot. After that, application code never reads `process.env` directly.

Every identifier-like string is a branded type: `UserId`, `OrgId`, `Email`, `Url`.

Every state machine is a discriminated union. An `absurd(x: never)` helper is imported and used in every exhaustive switch.

Pure logic that takes a value and returns another has a property-based test, using `fast-check` or similar.

Database access goes through Kysely or Drizzle. There is no raw SQL in application code.

Integration tests hit real dependencies. There is no `vi.mock` anywhere under `*.integration.test.ts`.

No secrets appear in source. Every secret is loaded from the environment with a schema-validated shape.

The default posture is all of the above on day one. Adding them later costs roughly ten times the effort, because the existing code will have been written to slack rules.

## Connection to the lint plugin

The lint plugin enforces the floor. If code trips any of its rules, the code is below the floor, and you fix it rather than suppress it without a written reason.

This skill describes the ceiling. It says what the code looks like when it is actively using the agent-era techniques, not just avoiding the forbidden ones.

Each rule in the plugin follows from one or more principles above:

The `async-keyword`, `promise-type`, and `then-chain` rules follow from principle four, typed errors, because `Promise<T>` erases the error channel.

The `bare-catch` rule follows from principles four and six, typed errors and exhaustiveness, because a silent catch hides both the error and the branch.

The `record-cast` and `no-manual-enum-cast` rules follow from principles three and two, validate at boundaries and types beat tests, because both casts paper over missing schemas or generated types.

The `no-raw-sql` rule follows from principles two and three, types over runtime checks and validated boundaries. Raw SQL defeats the compiler.

The `no-vitest-mocks` rule follows from integration-test integrity. Integration tests exist to catch real-dependency failures, not to assert against fictions.

The `no-hardcoded-secrets` rule follows from principle three. The environment is a boundary, so validate at boot.

Each rule ships a Before and After example at `node_modules/eslint-plugin-safer-by-default/docs/rules/<rule-name>.md`. Read the relevant doc before you attempt a fix.

## User sovereignty still wins

The user can always say "skip it, we ship tomorrow." Comply. But.

Name exactly what is being skipped. Something like: "We are shipping without the env schema. `process.env.STRIPE_KEY!` will return a 500 at runtime if the variable is missing."

Add a TODO that references this skill so the next agent sees the debt.

Never silently skip. Every shortcut is explicit, named, and attributed.

## When not to invoke

Pure refactors that preserve behavior. The existing code's level of discipline is out of scope.

Scripts with a single-use lifetime, like one-shot data migrations or CI glue. The compression math flips here: no future agent will read this code, and investing in ceremony would be waste.

Debugging sessions where the goal is to find a bug, not to ship new code. Apply the principles after the bug is understood.

## Closing

You were trained before the bottleneck moved. Your instincts are a historical artifact. Recalibrate, and write code that reflects where the bottleneck is now.
