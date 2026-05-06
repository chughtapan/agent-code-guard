# `agent-code-guard/no-cross-domain-sibling-import`

**What it flags:** Direct imports between sibling top-level feature folders,
such as `billing -> mail`, `network -> services`, or `task -> ws`.

Shared folders listed in `sharedFolderNames` are ignored.

**Why:** Sibling domains should not know each other's concrete files. They
should meet through a facade, registry, port, event, or shared kernel contract.

## Before (flagged)

```ts
// src/billing/charge.ts
import { sendReceipt } from "../mail/send-receipt";
```

## After (preferred)

```ts
// src/billing/charge.ts
import type { ReceiptPort } from "../ports/receipt";
```

The entrypoint wires the concrete mail adapter to the billing workflow.

## Options

```js
{
  "agent-code-guard/no-cross-domain-sibling-import": ["warn", {
    sharedFolderNames: ["shared", "common", "types", "schema", "testing"]
  }]
}
```
