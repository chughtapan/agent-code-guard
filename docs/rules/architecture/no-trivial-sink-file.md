# `agent-code-guard/no-trivial-sink-file`

**What it flags:** A non-test, non-index, non-public file with **exactly one consumer** and a **trivial surface** — at most 2 exported symbols and at most 5 top-level statements — whose sole consumer actually *uses* the imported symbols (not just re-exports them).

**Why:** When a file exists solely to provide a tiny bit of state or a one-liner helper to a single caller, the file boundary adds indirection without paying for itself. Inlining the contents at the call site:

- Removes a navigation hop (no jumping to another file to see the value).
- Removes the import statement (smaller mental model at the call site).
- Removes the maintenance overhead of keeping the small file in sync with how it's used.

When the file grows or gets a second consumer, *then* extracting it is the right call. Until then, prefer colocation.

## Before (flagged)

```ts
// src/feature/user-id.ts
export const USER_ID = "user-id" as const;

// src/feature/use.ts
import { USER_ID } from "./user-id.js";

export function loadUser() {
  return get(USER_ID); // only place USER_ID is used
}
```

## After (preferred)

```ts
// src/feature/use.ts
const USER_ID = "user-id" as const;

export function loadUser() {
  return get(USER_ID);
}
```

The single-line constant lives where it's used. If a second caller appears later, *that's* when extracting becomes valuable.

## Exceptions

The rule **does not fire** in these cases:

1. **The sole consumer pure-re-exports the symbol.** A `types/user.ts` whose only importer is `types/index.ts` (which re-exports `User`) is part of a barrel-shaped public API. Each leaf legitimately has fan-in=1 because the barrel is the actual API surface. Detected by behavior, not by filename — if the consumer's only operation on the symbol is `export { Foo } from "./leaf.js"`, the leaf is exempt.

2. **The file is itself a barrel** (all exports are re-exports). Barrels with one consumer are normal in nested package structures.

3. **The file is `index.ts`**, public-API-listed, or marked as an explicit facade.

4. **Test files.** Test fixtures and helpers that are imported once are fine.

5. **Generated files.**

## Suppression

```ts
/* @agent-code-guard/architecture-exception:
   no-trivial-sink-file
   reason: extracted intentionally for {documented reason}
*/
export const VALUE = 42;
```

## Pairing

- `shared-kernel-cohesion` — flags wide-but-incoherent shared modules.
- `no-fat-orchestrator` — the source-side analogue (high fan-out + low fan-in + substantive body).
