# `agent-code-guard/no-public-vendor-type-leak`

**What it flags:** Public package API types that mention dependency-owned,
devDependency-owned, peerDependency-owned, SDK, or vendor types.

Default severity is error for dependency/devDependency leaks. Peer dependency
types warn. Node built-ins warn unless `packageRuntime: "node"`. TypeScript and
lib DOM built-ins are ignored.

**Why:** Public types are contracts. If they mention a vendor SDK, database
client, transport, or generated dependency type, consumers now depend on that
implementation choice.

## Before (flagged)

```ts
import type { ChatCompletion } from "openai";

export interface ChatResult {
  readonly raw: ChatCompletion;
}
```

## After (preferred)

```ts
export interface ChatMessage {
  readonly id: string;
  readonly content: string;
}
```

Translate vendor shapes at the adapter edge and expose package-owned DTOs,
ports, and domain errors.

## Options

```js
{
  "agent-code-guard/no-public-vendor-type-leak": ["error", {
    publicTypePackages: ["react"],
    packageRuntime: "universal"
  }]
}
```

Use `publicTypePackages` only when the external package is intentionally part of
the public contract, such as React in a React component library.
