# `agent-code-guard/no-folder-cycle`

**What it flags:** Strongly connected components in the folder dependency
graph. A cycle is reported when two or more folders import or re-export
through each other so there is no acyclic dependency direction.

The analyzer treats each top-level child of `src/` (or the configured project
root) as a folder. Imports, type-only imports, and re-exports all count as
edges.

**Why:** Folder names should encode knowledge direction — what depends on
what. A cycle between `app`, `network`, and `db` means those three folders
are not independent abstractions; they are one coupled module spread across
directories. Cycles also force compilation/loading order to be runtime
behavior, which is brittle.

## Before (flagged)

```ts
// src/app/server.ts
import { send } from "../network/send";

// src/network/send.ts
import type { AppHost } from "../app/host";  // upward edge → cycle
```

The `app → network → app` cycle means neither folder hides anything from the
other. Refactoring either becomes a coordinated rewrite.

## After (preferred) — invert via a shared port

Move the shared contract into a folder both sides can depend on:

```ts
// src/ports/network.ts
export interface NetworkPort {
  readonly send: (frame: Frame) => Promise<void>;
}

// src/ports/host.ts
export interface AppHost {
  readonly id: string;
}

// src/app/server.ts
import type { NetworkPort } from "../ports/network";

// src/network/send.ts
import type { AppHost } from "../ports/host";
```

Now `app` depends on `ports`, `network` depends on `ports`, and the cycle is
broken. The composition root wires the concrete implementations together.

## After (preferred) — inject from the entrypoint

For runtime cycles where ports feel heavy:

```ts
// src/index.ts (composition root)
import { makeServer } from "./app/server";
import { makeSender } from "./network/send";

const sender = makeSender({ /* ... */ });
const server = makeServer({ sender });
```

`app/server.ts` accepts `sender` as a parameter; `network/send.ts` no longer
imports anything from `app/`.

## Options

```js
{
  "agent-code-guard/no-folder-cycle": ["error", {
    // Maximum number of cycle groups tolerated. Default 0 — any cycle fails.
    // Raise temporarily to 1-2 if you're untangling legacy code, but every
    // value above 0 is debt.
    maxFolderCycles: 0,
  }]
}
```

## Suppressing per-file via a directive

Cycles are usually structural; suppression rarely fixes the underlying
issue. If you genuinely need a one-off allowance (e.g., a generated barrel
that participates in both directions), suppress the rule for the offending
file with a written reason:

```ts
// @agent-code-guard/architecture-exception: no-folder-cycle
// reason: generated barrel; cycle resolved at codegen time

export * from "../app/host";
```

The `reason:` line is required. A directive without a reason surfaces as
an `architecture-directive-parse-error` diagnostic instead of silently
failing to suppress.

Prefer fixing the cycle. Cycles compound: each one makes the next harder
to break.

## Rationale

Cycles are the most direct violation of dependency direction.
