# `agent-code-guard/runpromise-requires-scoped`

> **Typed rule.** The `recommended` and `strict` presets provide the parser and
> `projectService` configuration. The linted file must belong to a
> `tsconfig.json`.

**What it flags:** A call to `Effect.runPromise`, `Effect.runPromiseExit`, `Effect.runSync`, or `Effect.runSyncExit` where the input Effect's `R` (requirements) parameter contains a `Scope`. Detected via the type checker.

**Why:** An Effect that needs a `Scope` is acquiring a resource (file handle, DB connection, subscription). Running it without first wrapping it in `Effect.scoped` (or providing a `Layer.scoped`) leaks the resource because there's nothing to call the finalizers. The runtime won't error — it just silently fails to clean up.

## Before (flagged)

```ts
import { Effect, Scope } from "effect";

const program = Effect.acquireRelease(
  Effect.sync(() => openHandle()),
  (handle) => Effect.sync(() => handle.close()),
); // R = Scope

const result = await Effect.runPromise(program); // flagged: handle never closes
```

## After (preferred)

Wrap with `Effect.scoped`:

```ts
const result = await Effect.runPromise(Effect.scoped(program));
```

Or, in larger programs, provide a scope-providing layer:

```ts
const program = pipe(
  acquireResource,
  Effect.provide(Layer.scoped(/* ... */)),
);

const result = await Effect.runPromise(program);
```

## Detection

The rule asks the TypeScript checker for the inferred type of the argument to `Effect.run*`. If the resulting type's string mentions `Scope`, the rule fires. This catches the common cases (`Effect<A, E, Scope>`, `Effect<A, E, Scope.Scope>`, `Effect<A, E, Scope | OtherSvc>`) without needing to walk the type graph.

False positive in theory: a custom service literally named `Scope` would also trip the rule. In practice this matches the Effect standard library convention.

## Setup

Spread `guard.configs.recommended` or `guard.configs.strict` into the matching
flat-config block. If a file is outside every TypeScript project, typed rules
cannot analyze it.

## Pairing

- `acquire-release-requires-scope` — flags `Effect.acquireRelease` calls without an enclosing `Effect.scoped` / `Layer.scoped`.
- `finalizer-requires-scope` — flags `Scope.addFinalizer` outside scoped context.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/runpromise-requires-scoped -- intentional: scope is owned by an outer runtime
const result = await Effect.runPromise(program);
```
