# effect/discriminants

Effect rules for typed-union discriminants — flagging manual
`_tag` / `_op` checks where the type-safe variant accessor exists.

| File | Rule | What it flags |
|------|------|---------------|
| `either-discriminant.ts` | `either-discriminant` | Manual `Either.isLeft` / `_tag === "Left"` checks before reaching for `.left`/`.right`; prefer the typed accessors. |
| `tag-discriminant.ts` | `tag-discriminant` | Manual `_tag === "..."` checks against tagged variants; prefer pattern-matching helpers. |

The `index.ts` here exports `discriminantsRules`, which the parent `effect/index.ts` spreads into the package's full rule map.
