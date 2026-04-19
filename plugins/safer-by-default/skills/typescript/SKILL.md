---
name: typescript
version: 0.1.0
description: |
  TypeScript craft floor. The concrete projection of PRINCIPLES.md principles 1
  through 4 onto TypeScript code. Invoked in-context by the implement-* skills
  when the target repo is TypeScript. Encodes the ideal repo state, the
  decision table between human-era shortcuts and agent-era full versions, the
  phrases that signal a shortcut is about to happen, and the mapping from
  eslint-plugin-agent-code-guard rules back to principles. Auto-applies when
  writing or reviewing .ts files outside of a /safer:spike branch.
triggers:
  - writing typescript
  - reviewing typescript
  - ts code
  - .ts file
  - effect typescript
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Grep
  - Glob
disable-model-invocation: false
---

# /safer:typescript

## Read first

Read `PRINCIPLES.md` at the plugin root. This skill is the projection of **principles 1 through 4** onto TypeScript:

- **1. Types beat tests.** Brand identifiers. Use discriminated unions for state. `NonEmptyArray<T>` instead of an array plus a length check.
- **2. Validate at every boundary.** Schemas at every input and output. Inside the boundary, types are truths. Outside, they are wishes.
- **3. Errors are typed, not thrown.** Tagged errors. Effect error channels. Discriminated-union result types. No raw `throw`, no bare `catch`.
- **4. Exhaustiveness over optionality.** Every switch over a union ends in `absurd(x)`. Every match closes on `orElse` or `exhaustive`. No implicit fallthrough.

Principles 5 through 8 (scope) are enforced by the invoking modality, not by this skill. This skill only describes code shape.

## Iron rule

> **In `/safer:spike`, these rules are suspended. Everywhere else they are hard.**

Spike branches buy speed by suspending craft. That is the modality's explicit payment. Outside a spike branch, the four principles above are floor, not ceiling. "Just a prototype" outside `/safer:spike` does not exist.

## Role

This skill is style reference, not workflow. It is invoked in-context by `implement-*` skills whenever TypeScript is being written or reviewed, and by `review-senior` when judging a TypeScript diff. It does not run its own preamble and does not emit its own telemetry. The invoking modality owns the session.

What this skill contributes:

1. The ideal TypeScript repo state that the code aims at.
2. A decision table mapping human-era shortcuts to agent-era full versions.
3. The phrases that signal a shortcut is about to happen; reject them on sight.
4. The mapping from `eslint-plugin-agent-code-guard` rules back to principles.
5. A list of invocation contexts where this skill does not apply.

## The ideal repo state

An agent-era TypeScript repo looks like this on day one. The `/safer:setup` skill automates the first four items.

- **`tsconfig.json` strict flags on.** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`. All five. No exceptions.
- **`eslint-plugin-agent-code-guard` installed** with the `recommended` preset wired to application source and the `integrationTests` preset wired to the integration-test glob.
- **`eslint-comments/require-description` set to `error`** so every `eslint-disable` carries a written reason.
- **`@typescript-eslint/no-magic-numbers` and `sonarjs/no-duplicate-string` on** at `"warn"` for magic numbers, `["warn", { threshold: 4 }]` for duplicates.
- **One schema library, picked once.** Effect Schema, Zod, or Valibot. Use it at every input and output boundary.
- **Every fallible operation returns an `Effect` or a discriminated-union result.** No raw `throw`. No `Promise<T>` return types on functions that can fail.
- **Environment variables validated at boot.** After that, application code never reads `process.env` directly. If you are using Effect, this is a `Config.string(...)` inside a `Layer`.
- **Identifier-like strings are branded.** `UserId`, `OrgId`, `Email`, `Url`. A plain `string` crossing between two of those types is a compiler error.
- **Every state machine is a discriminated union** with a final `absurd(x)` default branch.
- **Database access via Kysely or Drizzle.** No raw SQL in application code. If raw SQL is required for a performance-sensitive path, it is isolated in one module behind a typed wrapper.
- **Integration tests hit real dependencies.** No `vi.mock` under `*.integration.test.ts`.
- **No secrets in source.** Every secret loaded from the environment through a schema.
- **Pure functions have property-based tests** where the input space is small enough (via `fast-check` or similar).

Adding these later costs roughly ten times the effort. The surrounding code accretes to slack rules, and walking it back is its own refactor project.

## The decision table

Every row below is a fork where the agent will feel pulled toward the human-era shortcut. In every row, pick the agent-era full version.

| Scenario | Human-era shortcut | Agent-era full version |
|---|---|---|
| Parsing an API response | `(await r.json()) as Record<string, unknown>` | `Schema.decodeUnknown(Body)(await r.json())` |
| Parsing a JSON string | `JSON.parse(raw) as Payload` | `Schema.decodeUnknown(Payload)(JSON.parse(raw))` |
| Function that can fail | `throw new Error("bad")` | `return yield* Effect.fail(new BadError({ cause }))` |
| String union type | `row.status as "a" \| "b" \| "c"` | Import the generated `Status` union |
| Error in try/catch | `try { op() } catch {}` | `Effect.try({ try: op, catch: e => new OpError({ cause: e }) })` |
| `Effect.tryPromise` catch | `catch: (err) => err` | `catch: (cause) => new TaggedError({ cause })` |
| `fetch` inside `Effect.tryPromise` | `try: () => fetch(url, { ... })` | `try: (signal) => fetch(url, { signal, ... })` |
| Resource in a class | `private ref = Effect.runSync(Ref.make(0))` | Build in `Layer.effect`; inject via constructor |
| Env var access | `process.env.FOO!` | Env schema parsed once at boot |
| Async return type | `async f(): Promise<T>` | `(): Effect.Effect<T, E, R> => Effect.gen(...)` |
| Identifier type | `string` | `UserId = string & { __brand: "UserId" }` |
| Switch over union | `case "a": ... case "b": ...` | Final case returns `absurd(x)` where `absurd(x: never): never` |
| Match chain | `Match.value(x).pipe(Match.when(...))` | Close with `Match.exhaustive` or `Match.orElse(...)` |
| Throw in Effect code | `throw new Error("bad")` inside `Effect.gen` | `yield* Effect.fail(new TaggedError({ ... }))` |
| Callback signature | `(x) => Promise<void> \| void` | `(x) => Effect.Effect<void, E>` |
| Module-load env read | `const FOO = process.env.FOO!` at top level | `Config.string("FOO")` inside a Layer |
| Database query | `db.query("SELECT * FROM users WHERE id=?", [id])` | `kysely.selectFrom("users").where("id", "=", id).selectAll().execute()` |
| Happy-path test | One test asserting success | Happy path, each error path, property-based where applicable |
| Test double for an external service | `vi.mock("./stripe")` in integration test | Real stripe test mode, or a contract test against a recorded cassette |
| Positive integer | `function (n: number)` with runtime check | `function (n: PositiveInt)` where `PositiveInt` is branded |
| Non-empty array | `arr: T[]` with `if (arr.length === 0)` guard | `arr: NonEmptyArray<T>` |
| Pure function with a nameable algebraic property (roundtrip, idempotence, invariant, oracle agreement) | One example-based happy-path test | Happy path + `fast-check` property encoding the invariant |
| Pure function with no nameable algebraic property | "Write a property test; think of something" | Example tests covering boundary and each error path; skip property-based |
| Parser or handler accepting untrusted external input | Example tests for three known-bad inputs | Example tests + `fast-check` property + `Jazzer.js` via `@jazzer.js/jest-runner` when the threat model includes adversarial input |
| Parser with no adversarial threat model | Reach for `Jazzer.js` anyway | Example tests + `fast-check`; skip the fuzzer (Principle 6: compute is budget) |
| Test for code that reads a real database | `vi.mock("pg")` or an in-memory stand-in | `testcontainers-node` + `@testcontainers/postgresql`, shared-per-suite lifecycle, dynamic ports |
| Test for code that reads a real cache or queue | In-memory fake for redis/kafka/rabbitmq | `testcontainers-node` + `@testcontainers/redis` (or matching module); fake only behind a schema-checked contract |
| Two services in the same repo cross a shape boundary | Hand-written DTO types duplicated on both sides | Generate JSON Schema from the Zod/Effect schema; gate CI on `json-schema-diff` against the last-published schema |
| Cross-service boundary where a consumer is external or under SLA | Best-effort schema doc in a README | `@pact-foundation/pact` (Pact V4) contract test published to the broker |
| Critical UI flow (auth, checkout, primary CRUD) | "Unit test the React component" | Playwright E2E scoped to that flow; retry policy; screenshot diff off by default |
| Non-critical UI surface | Broad Playwright coverage "to be safe" | Component-level tests; skip E2E (Principle 6: scope the ladder to <N critical flows) |
| Coverage threshold as a CI gate | `jest --coverage --coverageThreshold` set to 80% | Report coverage as a diagnostic artifact only; **never** gate CI on a percentage (Goodhart; Inozemtseva & Holmes ICSE 2014). Gate CI on mutation score for critical modules instead (see row 18). Coverage gaps are investigated for cause (dead code? missing path?), not chased with filler tests. |
| Coverage report flags a gap in a module | Write tests until the number moves | Investigate: dead code? missing path? unreachable branch? Act on the cause, not the metric |
| Repo has a `test/**/*.test.ts` suite | `"lint"` job in CI, run tests locally | CI runs a `test` job that executes the full suite on every PR. A lint-only CI with tests on disk is Principle 1 corollary item 4 violation: tests that do not run are decoration. |
| Mutation testing on a critical module (auth, billing, parsing, crypto, webhook signing) | Skip, or run it everywhere | `@stryker-mutator/core` + `@stryker-mutator/typescript-checker`, **required CI gate**; scope the mutate glob to the critical module(s). Thresholds: `{ high: 80, low: 60, break: 50 }` as a starting point. |
| Mutation testing repo-wide | Run Stryker over every file | Scope the mutate glob to named critical modules. When no critical module is named, the fallback is `src/**` with `ignoreStatic: true` and incremental mode on; compute budget (Principle 6) still caps full-sweep to nightly. PR runs use incremental. |

The compression math: each full version costs seconds more to type. Each one removes one class of runtime bug. The shortcut's savings compound into next-session debt; the full version's savings compound into no-bug-ever.

## Phrases to reject

The following phrases signal that a human-era shortcut is about to happen. Catch them when they appear in your own output or in the user's request. Pause. Rewrite toward the full version.

- "This is just a prototype."
- "Not worth it for MVP."
- "We will add types later."
- "We will add tests later."
- "We will add validation later."
- "Good enough for now."
- "I will just cast it to `any`."
- "I will just cast it to `unknown`."
- "I will just cast it to `Record<string, unknown>`."
- "Let me silence the linter for this one."
- "The happy path is the important part."
- "Users will pass the right shape; do not worry about malformed input."
- "Do not over-engineer it."
- "Let me stub this for now and come back to it."
- "This is internal code, it does not need types."

When the user is the one asking for the shortcut, surface the compression cost in concrete numbers. Something like:

> That is a two-week task for a human and a thirty-minute task for an agent. The shortcut saves twenty-five minutes now and costs hours of debugging next sprint. Do you want the full version?

Then defer to user sovereignty if they insist. Name exactly what is being skipped, file it as a TODO that references this skill, and proceed. Never silently skip.

## Connection to `eslint-plugin-agent-code-guard`

The plugin is the lint floor. If code trips any of its rules, the code is below the floor. Fix the code; do not suppress the rule without a written reason.

Each rule maps back to a principle:

- **`async-keyword`, `promise-type`, `then-chain`** follow from **principle 3** (typed errors). `Promise<T>` erases the error channel; `async`/`await` is the sugar that hides it.
- **`bare-catch`** follows from **principle 3 and principle 4** (typed errors + exhaustiveness). A silent catch hides both the error and the branch.
- **`record-cast`** follows from **principle 2** (validate at boundaries). The cast papers over a missing schema at the edge.
- **`no-manual-enum-cast`** follows from **principle 1 and principle 2** (types beat tests + validation). Hand-written unions drift; generated or schema-derived ones do not.
- **`no-raw-sql`** follows from **principle 1 and principle 2** (types beat tests + boundary validation). Raw SQL defeats the compiler; a typed builder makes the schema load-bearing.
- **`no-vitest-mocks`** follows from integration-test integrity (not one of the four, but implied by principle 2: the mock is a fiction at the boundary).
- **`no-hardcoded-secrets`** follows from **principle 2** (validate at the environment boundary). A hardcoded secret bypasses the schema entirely.

Each rule ships a `Before` / `After` example at `node_modules/eslint-plugin-agent-code-guard/docs/rules/<rule-name>.md`. Read the relevant doc before attempting a fix.

## Suppression policy

Every `eslint-disable` carries a written reason; `eslint-comments/require-description` enforces this. A valid suppression:

```ts
// eslint-disable-next-line safer-by-default/no-raw-sql -- generated migration file; raw DDL by design
```

Invalid suppressions:

```ts
// eslint-disable-next-line -- fix later
// eslint-disable-next-line safer-by-default/bare-catch
```

"Fix later" is not a reason. A bare `eslint-disable-next-line` without a rule name silences every rule on that line; the plugin treats that as a rule violation in itself.

## Invocation contract

This skill is picked up in-context by the `implement-*` and `review-senior` skills. The contract:

- **`implement-junior` / `implement-senior` / `implement-staff`** load this skill whenever a `.ts` or `.tsx` file is about to be edited or created. The decision table above is the lookup they consult before writing any new construct.
- **`review-senior`** loads this skill whenever the diff under review touches `.ts` or `.tsx` files. The decision table becomes the rubric for flagging human-era shortcuts as review concerns.
- **`/safer:spike`** suppresses this skill inside a `spike/<slug>` branch; the suppression ends when the branch ends.
- **`/safer:setup`** is what installs the lint floor this skill points at. If `eslint-plugin-agent-code-guard` is not present in the target repo, invoke `/safer:setup` first. This skill relies on the lint floor; it is the ceiling.

This skill does not open its own preamble, does not emit telemetry, and does not transition labels. The invoking modality owns the session.

## Concrete before and after examples

The decision table compressed. Expanded versions of the most frequent forks.

**Parsing an HTTP response.**

Before:
```ts
async function getUser(id: string): Promise<User> {
  const r = await fetch(`/api/users/${id}`);
  return (await r.json()) as User;
}
```

After:
```ts
const getUser = (id: UserId): Effect.Effect<User, FetchError | DecodeError> =>
  Effect.gen(function* () {
    const r = yield* Effect.tryPromise({
      try: (signal) => fetch(`/api/users/${id}`, { signal }),
      catch: (cause) => new FetchError({ cause }),
    });
    const body = yield* Effect.tryPromise({
      try: () => r.json(),
      catch: (cause) => new DecodeError({ cause }),
    });
    return yield* Schema.decodeUnknown(User)(body);
  });
```

The before has one `async`, one cast, and zero error types. The after has three typed errors, one schema boundary, and a cancellable `fetch`. Cost: eight extra lines for an agent; hours of debugging saved.

**Exhaustive switch over a union.**

Before:
```ts
type Status = "pending" | "active" | "done";
function icon(s: Status): string {
  switch (s) {
    case "pending": return "pending";
    case "active":  return "active";
    case "done":    return "done";
  }
}
```

After:
```ts
type Status = "pending" | "active" | "done";
const absurd = (x: never): never => { throw new Error(`unreachable: ${x}`); };
function icon(s: Status): string {
  switch (s) {
    case "pending": return "pending";
    case "active":  return "active";
    case "done":    return "done";
    default:        return absurd(s);
  }
}
```

Add a fourth value to `Status` and the after version turns `absurd(s)` into a compile error at this call site. The before version silently returns `undefined`.

## When not to invoke

This skill is suspended or does not apply in the following contexts:

- **Inside a `/safer:spike` branch.** Spikes suspend principles 1 through 4. The spike branch is the boundary; the suspension ends when the branch ends.
- **One-shot scripts.** Data migrations that run once and are deleted. CI glue scripts read once in a config file. The compression math flips: no future agent reads these, so ceremony is waste.
- **Debugging sessions.** When the goal is to understand a bug, not to ship new code. Apply the principles after the bug is understood and `/safer:implement-*` is writing the fix.
- **Pure style refactors that preserve behavior.** The existing code's level of discipline is out of scope for a refactor that moves text around without changing shape. If the refactor is introducing new code paths, this skill applies to the new code.
- **Generated code.** Do not hand-edit generated output to conform to these rules. The generator must produce conforming output, or the generator itself is what needs fixing.

If you are unsure whether this skill applies, the default is that it applies. "Just prototype" and "just temporary" are the phrases the rejection list above is designed to catch.

## Voice

See `PRINCIPLES.md` voice section. This skill's output is code; the code's voice is the type system. A signature that encodes the constraint speaks louder than a comment that describes it. Prefer the signature.

When you do leave a comment, it explains the hidden constraint or the workaround, never the shape the reader can see. "This branch handles the legacy V1 envelope that pre-2024 clients still send" is a comment worth writing. "This function parses JSON" is not.

The next agent touching this code is a junior. The type system is the document that junior reads first. Make it say the right thing.
