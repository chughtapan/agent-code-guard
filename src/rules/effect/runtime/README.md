# effect/runtime

Effect rules that target runtime primitives — Promise interop, concurrency
options, platform packages, and config redaction. These are the
"how do you actually run this thing" rules: not Effect's domain shapes
(error / option / result), but the wiring around them.

| File | Rule | What it flags |
|------|------|---------------|
| `no-promise-all-in-effect.ts` | `no-promise-all-in-effect` | `Promise.all` / `allSettled` / `race` / `any` in Effect files. |
| `effect-foreach-requires-concurrency.ts` | `effect-foreach-requires-concurrency` | `Effect.forEach` calls without an explicit `concurrency` option. |
| `prefer-effect-platform.ts` | `prefer-effect-platform` | Raw `fs` / `http` imports, `process.argv`, bare `fetch()`, raw SQL drivers, and CLI libs in Effect files. Single rule with options table. |
| `prefer-config-redacted.ts` | `prefer-config-redacted` | `Config.string("name")` calls where `name` looks like a secret (api_key, secret, token, password, ...). |

The `index.ts` here exports `runtimeRules`, which the parent `effect/index.ts` spreads into the package's full rule map.
