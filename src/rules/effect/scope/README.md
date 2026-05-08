# effect/scope

Effect rules for scoped resource lifecycles. Anything that opens a resource
needs an enclosing `Scope` to close it; anything that runs an Effect with a
`Scope` requirement needs `Effect.scoped` to satisfy it.

| File | Rule | What it flags |
|------|------|---------------|
| `acquire-release-requires-scope.ts` | `acquire-release-requires-scope` | `Effect.acquireRelease` / `acquireUseRelease` in files with no `Effect.scoped` / `Layer.scoped` reference. |
| `finalizer-requires-scope.ts` | `finalizer-requires-scope` | `Scope.addFinalizer` calls in files with no scoped frame reference. |
| `fork-requires-lifecycle.ts` | `fork-requires-lifecycle` | `Effect.fork(...)` whose Fiber is structurally discarded (not captured, not awaited, not interrupted). |
| `runpromise-requires-scoped.ts` | `runpromise-requires-scoped` (typed) | `Effect.runPromise` / `runSync` whose input Effect requires `Scope`. Uses parser services for the type query. |

The `index.ts` here exports `scopeRules`, which the parent `effect/index.ts` spreads into the package's full rule map.
