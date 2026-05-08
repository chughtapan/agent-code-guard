# `agent-code-guard/no-cross-domain-sibling-import`

**What it flags:** Direct imports between sibling top-level feature folders
under `src/`. Examples: `src/billing/` importing from `src/mail/`,
`src/network/` importing from `src/services/`, `src/task/` importing from
`src/ws/`.

Folders listed in `sharedFolderNames` are exempt — sibling-to-shared
imports are fine. The list is empty by default; declare your shared
kernels with reasons in your config (see "How to configure" below).

When you've also declared `layers` and both endpoints of an import are
inside layered folders, this rule defers entirely to the layers system.
Layers express direction across folders, so the sibling-domain check
would be redundant — direction enforcement belongs to
[`no-upward-layer-import`](./no-upward-layer-import.md).

**Why:** Sibling domains shouldn't know each other's concrete files. If
`billing/charge.ts` imports `mail/send-receipt.ts` directly, billing now
depends on the file structure of mail. Refactoring mail breaks billing.
Worse, the dependency direction is implicit — neither folder advertises
"I depend on the other," so the coupling is invisible until something
breaks.

The rule warns rather than errors because the right answer depends on
how strict your domain boundaries are. Monorepos with explicit package
boundaries enforce this naturally; single-repo projects often slip.

## Before (flagged)

```ts
// src/billing/charge.ts
import { sendReceipt } from "../mail/send-receipt";  // sibling import → flagged

export async function charge(amount: number) {
  // ... charge logic ...
  await sendReceipt(amount);
}
```

`billing` now depends on `mail`. If `mail/` reorganizes into
`mail/templates/receipt/send.ts`, billing breaks.

## After (preferred) — meet through a port

```ts
// src/ports/receipt.ts
export interface ReceiptPort {
  readonly send: (amount: number, recipient: string) => Promise<void>;
}

// src/billing/charge.ts
import type { ReceiptPort } from "../ports/receipt";

export async function charge(deps: { readonly receipt: ReceiptPort }, amount: number) {
  // ... charge logic ...
  await deps.receipt.send(amount, /* ... */);
}

// src/mail/send-receipt.ts (private to mail)
import type { ReceiptPort } from "../ports/receipt";

export const receiptAdapter: ReceiptPort = {
  send: async (amount, recipient) => { /* ... */ },
};

// src/index.ts (composition root)
import { charge } from "./billing/charge";
import { receiptAdapter } from "./mail/send-receipt";

export const billing = { charge: (n) => charge({ receipt: receiptAdapter }, n) };
```

Billing depends on the receipt port. Mail provides one. The composition
root wires them. Either side can be reorganized internally without
affecting the other.

## After (preferred) — meet through events

When the cross-domain communication is fire-and-forget:

```ts
// src/ports/events.ts
export interface ChargeCompletedEvent {
  readonly _tag: "ChargeCompleted";
  readonly amount: number;
  readonly recipient: string;
}

// src/billing/charge.ts
export async function charge(emit: (e: ChargeCompletedEvent) => void, amount: number) {
  // ... charge logic ...
  emit({ _tag: "ChargeCompleted", amount, recipient: "..." });
}

// src/mail/listen.ts
export function onChargeCompleted(e: ChargeCompletedEvent) {
  /* ... send receipt ... */
}
```

Billing emits events; mail subscribes. They never reference each other.

## How to configure

The plugin ships no defaults for `sharedFolderNames`. Declare the folders
that genuinely act as shared kernels in your repo, each with a written
reason. Common values to consider:

```js
{
  "agent-code-guard/no-cross-domain-sibling-import": ["warn", {
    sharedFolderNames: [
      { folder: "shared", reason: "explicit shared kernel" },
      { folder: "common", reason: "explicit shared kernel" },
      { folder: "utils", reason: "utility helpers used by every feature" },
      { folder: "types", reason: "shared type definitions" },
      { folder: "ports", reason: "domain-owned ports implemented by adapters" },
      { folder: "testing", reason: "consumer test helpers" },
    ],
  }]
}
```

Pick only the folders that actually exist in your repo with that role.
Test directories like `__tests__/`, `test-support/`, and explicitly
test-named files are already exempt regardless of this option.

## Suppressing per-file via a directive

Sibling-to-sibling imports are usually a sign that two folders aren't really
separate domains. Before suppressing, ask: should these be one folder?
Should they meet through a port? Should one of them be a shared kernel?

For unavoidable cases (e.g., a bootstrap file that legitimately wires
multiple domains), use a file-header directive:

```ts
// @agent-code-guard/architecture-exception: no-cross-domain-sibling-import
// reason: composition root; intentional cross-domain wiring

import { receiptAdapter } from "../mail/send-receipt";
```

The `reason:` line is required; missing reasons surface as
`architecture-directive-parse-error` diagnostics.

If you find yourself directive-suppressing on multiple non-composition
files, your domain boundaries are blurry. Better to merge the folders or
introduce a ports layer than scatter suppressions.

## Rationale

Domain boundaries are encoded in folder structure precisely so they're
visible at review time. Direct sibling imports erase that visibility.
