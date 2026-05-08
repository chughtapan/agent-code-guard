# `agent-code-guard/no-distant-folder-import`

**What it flags:** Local imports that reach across too many folder hops.

Default: more than 4 folder hops.

**Why:** Layer rules catch direction. This catches reach. A file under
`game/x/y/z` importing directly from `server/a/b/c` is suspicious even if a
layer declaration says the direction is legal. The importing file now knows a
distant implementation layout instead of a nearby facade, port, or package
boundary.

This rule warns because long imports can be legitimate during migration or
when a repo intentionally keeps coarse packages. The signal is strong enough
to review, but not always strong enough to fail CI.

## Before (flagged)

```ts
// src/game/render/client/screen.ts
import { persistScore } from "../../../server/storage/postgres/score-store";
```

The caller reaches across multiple folder decisions: product area, server
runtime, storage adapter, persistence backend.

## After (preferred)

```ts
// src/game/render/client/screen.ts
import { scorePort } from "../../ports/score";

// src/game/ports/score.ts
export { persistScore } from "../../server/storage";
```

The distant implementation is hidden behind a nearer semantic boundary.

## Options

```js
{
  "agent-code-guard/no-distant-folder-import": ["warn", {
    // Maximum folder hops between importer folder and imported folder.
    // Default: 4.
    maxFolderImportDistance: 4,
  }]
}
```

Test-like and generated files are ignored automatically.
