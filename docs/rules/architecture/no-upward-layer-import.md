# `agent-code-guard/no-upward-layer-import`

**What it flags:** Lower-level files importing parent or root facades — for
example, `src/db/client.ts` importing from `../index` (the package root) or
`../`.

**Why:** A child folder importing a parent or root index reverses
dependency direction. Lower-level implementation files should depend on
narrow contracts beside or below them, not on the facade assembled above
them. When `db/client.ts` reaches up to import `logger` from the root
`index.ts`, three things go wrong:

- The composition order becomes implicit (root must load first).
- The "private" file now knows about the public assembly.
- Tests of `db/client.ts` have to mock the entire root facade.

This rule warns rather than errors because the right answer depends on
how your repo is layered. Some repos use a single shared kernel at the
root; others have an explicit `ports/` or `shared/` folder.

## Before (flagged)

```ts
// src/db/client.ts (lower-level implementation)
import { logger } from "../index";  // upward import → flagged

export function makeClient() {
  logger.info("connecting...");
  return { /* ... */ };
}
```

`db/client.ts` now depends on `index.ts`. Anyone testing `db/client.ts`
has to load (and mock) the entire package root.

## After (preferred) — depend on a narrow port

Move `LoggerPort` (the contract) into a folder both layers can depend on:

```ts
// src/ports/logger.ts
export interface LoggerPort {
  readonly info: (message: string) => void;
  readonly error: (message: string) => void;
}

// src/db/client.ts
import type { LoggerPort } from "../ports/logger";

export function makeClient(deps: { readonly logger: LoggerPort }) {
  deps.logger.info("connecting...");
  return { /* ... */ };
}
```

`db/client.ts` depends on `ports/logger.ts` (sideways, lower). The
composition root injects the concrete logger.

## After (preferred) — inject from the entrypoint

For values that don't need a full port:

```ts
// src/index.ts
import { makeClient } from "./db/client";
import { logger } from "./logger";

export const client = makeClient({ logger });
```

`db/client.ts` doesn't import `logger` at all; it receives one.

## Options

```js
{
  "agent-code-guard/no-upward-layer-import": ["warn", {
    // Folder names treated as shared kernels. Lower-level files importing
    // from these folders are NOT flagged — shared kernels are designed to
    // be imported across the layer boundary. Each entry MUST include both
    // `folder` and `reason`; bare strings are rejected by the schema.
    // Defaults cover common kernel names (shared, common, utils, etc.).
    sharedFolderNames: [
      { folder: "platform-kernel", reason: "internal kernel; designed to be reachable from any layer" },
    ],
  }]
}
```

## Suppressing per-file via a directive

For genuinely shared values that don't fit the shared-kernel model (e.g., a
package version constant lives at the root and is loaded only once):

```ts
// @agent-code-guard/architecture-exception: no-upward-layer-import
// reason: VERSION is read once at root via createRequire; lifting it to a port would be silly

import { VERSION } from "../index";
```

The `reason:` line is required; missing reasons surface as
`architecture-directive-parse-error` diagnostics.

If you find yourself directive-suppressing on more than a couple of files,
consider adding the source folder to `sharedFolderNames`. The rule is
designed to catch *accidental* upward dependencies, not punish deliberate
shared-kernel usage.

## Rationale

Dependency direction encodes design intent. Upward imports are usually
accidents — a quick "I needed `logger`, the root has it" decision that
becomes structural debt. See
[`docs/architecture-boundary-ledger.md`](../../architecture-boundary-ledger.md)
for the full layering treatment.
