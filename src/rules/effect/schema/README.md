# effect/schema

Effect rules for `@effect/schema` decode boundaries. Decoders convert
unknown data to typed values; the rules here keep that conversion inside the
Effect channel rather than letting throws or casts skip past it.

| File | Rule | What it flags |
|------|------|---------------|
| `no-schema-type-cast.ts` | `no-schema-type-cast` | Bare casts to `Schema.Schema.Type<typeof S>` / `Schema.Schema.Encoded` / `Schema.Type` / `Schema.Encoded`. |
| `prefer-decode-effect-at-boundary.ts` | `prefer-decode-effect-at-boundary` | `Schema.decodeUnknownSync` / `decodeSync` / `decodeUnknownEither` over `JSON.parse`, `fs.read*`, or `fetch` results. |
| `parse-into-schema-requires-effect.ts` | `parse-into-schema-requires-effect` | `Schema.decode*(...)(JSON.parse(x))` chains outside an `Effect.try` thunk. |

The `index.ts` here exports `schemaRules`, which the parent `effect/index.ts` spreads into the package's full rule map.
