# `agent-code-guard/require-boundary-owned-types`

**What it flags:** Public boundary declarations that directly mention imported
external type names.

**Why:** Even when a type leak is not caught through TypeScript symbol traversal,
an exported declaration that names `OpenAI.ChatCompletion`, `Kysely<Db>`, or
`pino.Logger` is still making an external package part of your contract.

## Before (flagged)

```ts
import type { ChatCompletion } from "openai";

export interface CompletionResult {
  readonly raw: ChatCompletion;
}
```

## After (preferred)

```ts
export interface CompletionResult {
  readonly id: string;
  readonly text: string;
}
```

Translate at the adapter edge. Export package-owned names from the boundary.

## Options

```js
{
  "agent-code-guard/require-boundary-owned-types": ["error", {
    publicTypePackages: ["react"]
  }]
}
```
