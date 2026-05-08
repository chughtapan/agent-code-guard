# effect/error

Effect rules for the typed error channel — flagging shapes that erase
typed errors, collapse error variants, or bridge to Promises without
typed error handling.

| File | Rule | What it flags |
|------|------|---------------|
| `effect-error-erasure.ts` | `effect-error-erasure` | `Effect.fail(new Error(...))` and similar shapes that erase typed error variants. |
| `no-effect-error-coalescing.ts` | `no-effect-error-coalescing` | `Effect.catchAll` / `catchAllCause` / `mapError` that collapse distinct typed error variants into one wrapper. |
| `effect-promise.ts` | `effect-promise` | `Effect.promise(...)` over Promise-returning calls — use `Effect.tryPromise` so the failure stays in the typed error channel. |

The `index.ts` here exports `errorRules`, which the parent `effect/index.ts` spreads into the package's full rule map.
