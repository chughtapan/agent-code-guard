# Rules

This folder owns the individual ESLint rule implementations and the plugin
rule registry.

Rule families are grouped by the kind of shape they inspect:

- `async-flow/` catches erased async and nullish-control-flow contracts.
- `effect/` catches Effect/Either error-channel and discriminant misuse.
- `manual-algebra/` catches hand-rolled types that duplicate library algebras.
- `safety/` catches unsafe casts, secrets, raw SQL, and runtime environment reads.
- `testing/` catches committed test hygiene issues.
- `tooling/` catches repo-quality gate drift such as dead-code checks falling
  out of the default lint script.

`registry.ts` is the plugin-facing facade. New rule families should get their
own folder when they have more than one rule or need shared implementation.
