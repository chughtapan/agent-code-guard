# Effect Rules

This folder owns rules for Effect, Either, and `@effect/*` package
conventions. Anything specific to Effect's runtime, error channel,
schema decoding, scope/resource lifecycle, observability, or platform
ergonomics belongs here.

The folder is organized by Effect concern. Each sub-family has its own
`README.md` listing the rules it owns; the table below is the index.

| Sub-family | What lives there |
|------------|------------------|
| [`error/`](./error/README.md) | typed-error channel rules (erasure, coalescing, Promise→Effect bridges) |
| [`discriminants/`](./discriminants/README.md) | manual `_tag` checks vs typed variant accessors |
| [`scope/`](./scope/README.md) | scoped-resource lifecycle (`acquireRelease`, finalizers, fork lifecycle, `runPromise` w/ Scope) |
| [`schema/`](./schema/README.md) | `@effect/schema` decode boundaries (no bare casts, prefer Effect-returning decoders) |
| [`observability/`](./observability/README.md) | logger config, `Effect.log` shape, `withSpan` boundaries, span annotations |
| [`runtime/`](./runtime/README.md) | Promise interop, concurrency options, platform packages, config redaction |

The `index.ts` here is the family facade: it imports each sub-family's
rule map and spreads them into a single `effectRules` export consumed
by `src/rules/registry.ts`. New rules belong inside one of the
sub-families; pick the closest match or add a new sub-family with its
own `index.ts` + `README.md` if none fits.
