# `agent-code-guard/require-boundary-owned-types`

**What it flags:** Public boundary declarations whose names directly
mention imported external type names. Examples: an exported
`CompletionResult` whose `raw` field is typed as `OpenAI.ChatCompletion`,
an exported `ServerHost` whose `db` is `Kysely<DbSchema>`, an exported
`LogEntry` whose `logger` is `pino.Logger`.

This is a sibling of `no-public-vendor-type-leak` — that rule walks the
TypeScript type checker output to find structural leaks; this one catches
syntactic leaks where the imported name itself appears in an exported
declaration. They overlap by design; this one is the safety net for cases
where the type checker walk misses something.

**Why:** Even when a vendor type doesn't structurally leak through to
consumers (because the field is, say, `unknown` at the type level), an
exported declaration that *names* `OpenAI.ChatCompletion` is still
documenting that as part of your contract. Consumers will reason about
what they think the field contains based on the name; future refactors
that swap the underlying SDK will need a public-API rename to match.

Public types should use names you own.

## Before (flagged)

```ts
import type { ChatCompletion } from "openai";

export interface CompletionResult {
  readonly raw: ChatCompletion;
}
```

The name `ChatCompletion` is OpenAI-owned. If you swap to Anthropic, this
exported field needs a rename — or worse, stays misnamed.

## After (preferred) — use package-owned names

```ts
export interface CompletionResult {
  readonly id: string;
  readonly text: string;
  readonly finishReason: "stop" | "length" | "filter";
}
```

Every name in the public type is yours. Whatever SDK you use behind the
scenes is irrelevant to consumers.

## After (preferred) — opaque pass-through with package-owned alias

When you genuinely want to expose the vendor shape (e.g., for debugging
or extensibility) but don't want to lock the name:

```ts
// src/index.ts
export type RawCompletion = unknown & { readonly __vendor: "completion" };

export interface CompletionResult {
  readonly id: string;
  readonly text: string;
  readonly raw: RawCompletion;  // package-owned name; consumers can pass through
}
```

Consumers can store and forward `raw` without depending on its shape. If
you later swap SDKs, only the runtime cast at the adapter changes — the
public type stays the same.

## Options

```js
{
  "agent-code-guard/require-boundary-owned-types": ["error", {
    // Same as no-public-vendor-type-leak: packages whose types are
    // intentionally part of the public contract. Each entry MUST include
    // both `package` and `reason`; bare strings are rejected by the schema.
    publicTypePackages: [
      { package: "react", reason: "this is a React component library" },
    ],
  }]
}
```

## Suppressing per-file via a directive

Per-line `eslint-disable-next-line` does not suppress architecture rules
cleanly — diagnostics report at the Program node. Use a file-header
directive instead:

```ts
// @agent-code-guard/architecture-exception: require-boundary-owned-types
// reason: this package extends OpenAI types; consumers expect them

export type { ChatCompletion } from "openai";
```

The `reason:` line is required; missing reasons surface as
`architecture-directive-parse-error` diagnostics.

The same rule of thumb applies as `no-public-vendor-type-leak`: if you
suppress on more than a couple of files, add the package to
`publicTypePackages` instead. That's the place to declare structural
intent.

## Rationale

Naming is design. The names in your public types are your contract; they
should be names you own and control.
