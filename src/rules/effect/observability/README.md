# effect/observability

Effect rules for logging, tracing, and span boundaries.

| File | Rule | What it flags |
|------|------|---------------|
| `no-console-in-effect.ts` | `no-console-in-effect` | `console.*` calls in files importing `"effect"` or `"@effect/*"`. Use `Effect.log` and friends. |
| `logger-config-at-boot.ts` | `logger-config-at-boot` | `Logger.withMinimumLogLevel` / `withConsoleLog` / `withConsoleError` outside boot files. |
| `prefer-annotate-logs.ts` | `prefer-annotate-logs` | `Effect.log*` with an inline object literal — use `Effect.annotateLogs` once. |
| `require-span-on-exported-effect.ts` | `require-span-on-exported-effect` | Exported `Effect.gen` values without a `withSpan` reference in the export's subtree. |
| `handler-requires-span.ts` | `handler-requires-span` | `Effect.gen` bodies in handler/route files without `withSpan`. |
| `annotate-without-span.ts` | `annotate-without-span` | `Effect.annotateCurrentSpan` calls in files with no `withSpan` reference. |

The `index.ts` here exports `observabilityRules`, which the parent `effect/index.ts` spreads into the package's full rule map.
