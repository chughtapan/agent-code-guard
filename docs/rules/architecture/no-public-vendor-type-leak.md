# `agent-code-guard/no-public-vendor-type-leak`

**What it flags:** Public package API types whose TypeScript type graph reaches
into a dependency, devDependency, peerDependency, SDK, or generated vendor
type. The analyzer walks the type checker output for every exported symbol —
generics, unions, function signatures, namespaces, and `import("...")` type
expressions all count.

**Why:** Public types are the contract you ship. The moment a vendor SDK shape
or generated database type appears in an exported signature, your consumers
inherit it. Switching the SDK, swapping the database client, or moving to a
different transport becomes a breaking change you didn't intend to make.

## Severity

| Source of the leaked package                 | Severity | Reason                                                                 |
|----------------------------------------------|----------|------------------------------------------------------------------------|
| `dependencies` or `devDependencies`          | error    | Consumers can't influence which version they get; you're imposing one. |
| `peerDependencies`                           | warn     | Consumers opt in; the contract is acknowledged.                        |
| `node:*` built-ins, `packageRuntime: "node"` | allowed  | Package declares itself node-facing.                                   |
| `node:*` built-ins, other `packageRuntime`   | warn     | Universal/browser packages should not leak Node types.                 |
| TypeScript and lib DOM built-ins             | ignored  | These are the host environment, not vendor packages.                   |

## Declaring the contract is the point

When the rule fires on a package you DO mean to expose
(`@typescript-eslint/utils` for an ESLint plugin, `react` for a React component
library), add it to `publicTypePackages` with a written reason. The schema
**requires** the reason — bare strings are rejected. The act of writing the
reason IS the design decision: "this package is part of my public contract,
and here is why."

If you find yourself adding more than a handful of packages, that is signal
that your public surface is fragmented. Translate at the adapter edge instead.

## Before (flagged)

```ts
// src/index.ts
import type { ChatCompletion } from "openai";

export interface ChatResult {
  readonly raw: ChatCompletion;
}
```

A consumer using `ChatResult` now needs `openai` types installed and is locked
to whatever shape OpenAI's SDK currently has.

## After (preferred) — translate at the adapter edge

```ts
// src/index.ts (public)
export interface ChatMessage {
  readonly id: string;
  readonly content: string;
  readonly finishReason: "stop" | "length" | "filter";
}

// src/internal/openai-adapter.ts (private)
import type { ChatCompletion } from "openai";

export function fromOpenAI(raw: ChatCompletion): ChatMessage {
  return {
    id: raw.id,
    content: raw.choices[0]?.message.content ?? "",
    finishReason: raw.choices[0]?.finish_reason ?? "stop",
  };
}
```

Public types are package-owned. The OpenAI shape stays a private
implementation concern.

## After (preferred) — declare the contract when the leak is intentional

```js
// eslint.config.js
"agent-code-guard/no-public-vendor-type-leak": ["error", {
  publicTypePackages: [
    {
      package: "@typescript-eslint/utils",
      reason: "this package is an ESLint plugin; the TSESLint rule contract is the public API",
    },
  ],
  packageRuntime: "node",
}],
```

Use this when the leak is the contract — ESLint plugins, React component
libraries, AST tools, etc. The reason is required by the schema; it surfaces
in config review and CHANGELOG context.

## Options

```js
{
  "agent-code-guard/no-public-vendor-type-leak": ["error", {
    // Packages whose types are intentionally part of the public contract.
    // Each entry MUST include both `package` and `reason`. Bare strings
    // are rejected by the schema.
    publicTypePackages: [
      { package: "react", reason: "this is a React component library" },
    ],

    // "node" allows node:* built-ins in the public surface (use for
    // node-facing packages). "browser" or "universal" (default) reject
    // them with warn-level diagnostics.
    packageRuntime: "universal",
  }]
}
```

## Suppressing per-file via a directive

Per-line `eslint-disable-next-line` does not work for architecture rules:
the diagnostic reports at the Program node, so a per-line disable suppresses
every architecture rule on that line, not just one. Use a file-header
directive instead — the directive parser reads the leading comment block and
suppresses the matching rule for the whole file.

```ts
// @agent-code-guard/architecture-exception: no-public-vendor-type-leak
// reason: this overload deliberately re-exports ESLint Linter.RuleEntry shape

import type { TSESLint } from "@typescript-eslint/utils";
export type RuleEntry = TSESLint.Linter.RuleEntry;
```

The `reason:` line is required. A directive without a reason surfaces as an
`architecture-directive-parse-error` diagnostic instead of silently failing
to suppress.

If you find yourself adding directives on multiple files, prefer adding the
package to `publicTypePackages` — that says the leak is structural, not
file-local.

## Rationale

Public types are part of your package's promise to the world. Vendor-typed
public surfaces lock consumers to your implementation choices and make
adapter-pattern refactors into breaking changes. See
[`docs/architecture-boundary-ledger.md`](../../architecture-boundary-ledger.md)
for the full Boundary Ledger treatment.
