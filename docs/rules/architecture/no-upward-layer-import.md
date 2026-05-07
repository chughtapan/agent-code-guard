# `agent-code-guard/no-upward-layer-import`

**What it flags:** Imports that go UP your declared layered architecture.
You declare layers in dependency order: layer 0 is the topmost (entrypoint),
the last layer is the deepest (shared kernel). A file in layer N may import
from any folder in layer N+1, N+2, ... (downward, including skipping
layers). It may NOT import from layer N-1 or above.

The rule fires only when you've declared `layers` in your config. With no
layers declared, the rule is dormant — it has no opinion on how your
folders relate.

**Why:** A lower-numbered layer importing a higher-numbered layer reverses
dependency direction. Composition flows entrypoint → app → domain →
adapters → kernel; data flows the other way. Reversing it makes the
"private" layer depend on the public assembly above it, which means tests
have to mock the assembly, swap operations become breaking changes, and
the architecture stops paying for the discipline.

## How to configure

Declare layers in your `eslint.config.js`. Each layer has a name, a list
of folder paths it owns, and a written reason. Folder paths are relative
to the project root, can be at any depth, and the longest matching prefix
wins (so `domain/billing` is more specific than `domain`).

```js
"agent-code-guard/no-upward-layer-import": ["error", {
  layers: [
    {
      name: "entrypoint",
      folders: ["."],
      reason: "src/index.ts composes the app",
    },
    {
      name: "app",
      folders: ["app"],
      reason: "request orchestration; depends on domain + adapters",
    },
    {
      name: "domain",
      folders: ["domain"],
      reason: "business logic; depends only on shared kernel",
    },
    {
      name: "adapters",
      folders: ["adapters", "infrastructure"],
      reason: "outbound implementations of domain ports",
    },
    {
      name: "kernel",
      folders: ["shared", "ports"],
      reason: "domain-owned ports and shared utility types",
    },
  ],
}],
```

With this config, `app/x.ts` importing from `domain/y.ts` is clean
(downward by one layer); `app/x.ts` importing directly from `shared/z.ts`
is also clean (downward, skipping intermediate layers); `domain/x.ts`
importing from `app/y.ts` flags as upward.

## Before (flagged)

With the layer config above:

```ts
// src/domain/billing/charge.ts (layer "domain")
import { auditLog } from "../../app/audit";  // imports layer "app" — flagged

export function charge(amount: number) {
  auditLog(amount);
}
```

The diagnostic message names both layers so you see exactly which
relationship is wrong:

> `src/domain/billing/charge.ts (layer 'domain') imports upward into
> src/app/audit.ts (layer 'app').`

## After (preferred) — depend on a port at the right level

Move the contract into a layer that domain can legitimately depend on:

```ts
// src/ports/audit.ts (layer "kernel")
export interface AuditPort {
  readonly log: (amount: number) => void;
}

// src/domain/billing/charge.ts (layer "domain")
import type { AuditPort } from "../../ports/audit";

export function charge(audit: AuditPort, amount: number) {
  audit.log(amount);
}
```

Now domain depends on kernel (downward), composition flips control at the
entrypoint, and refactoring `app/audit` doesn't ripple through domain.

## After (preferred) — inject from the entrypoint

For values that don't deserve a port:

```ts
// src/index.ts (layer "entrypoint")
import { auditLog } from "./app/audit";
import { charge } from "./domain/billing/charge";

export const billing = {
  charge: (amount: number) => charge(auditLog, amount),
};
```

`domain/billing/charge.ts` accepts `auditLog` as a parameter; it never
imports from `app/`.

## Suppressing per-file via a directive

For genuinely unavoidable cases (e.g., a generated barrel that has to
reference both layers), suppress the rule for the offending file with a
written reason:

```ts
// @agent-code-guard/architecture-exception: no-upward-layer-import
// reason: codegen output; cycle resolved at build time

import { type Plugin } from "../index";
```

The `reason:` line is required; missing reasons surface as
`architecture-directive-parse-error` diagnostics.

If you find yourself directive-suppressing on more than a couple of files,
the layering is wrong. Either move the contract down, invert the
dependency, or redraw the layer boundaries.

## Rationale

Dependency direction encodes design intent. Layered configurations make
that intent first-class: you declare the layers, the linter enforces the
direction. See
[`docs/architecture-boundary-ledger.md`](../../architecture-boundary-ledger.md)
for the full layering treatment.
