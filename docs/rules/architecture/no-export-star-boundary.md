# `agent-code-guard/no-export-star-boundary`

**What it flags:** Public or index boundary files that use `export *`.

**Why:** `export *` makes the boundary inherit every current and future export
from the target module. A later helper export can become public without a
deliberate API decision.

## Before (flagged)

```ts
export * from "./schema";
export * from "./runtime";
export * from "./db";
```

## After (preferred)

```ts
export type { ProtocolFrame, ProtocolError } from "./schema";
export { parseFrame, encodeFrame } from "./schema";
```

Name the contract explicitly. Future exports then require an intentional diff.

## Exceptions

Generated type packages may suppress this rule with a written reason. For hand
written facades, prefer named reexports.
