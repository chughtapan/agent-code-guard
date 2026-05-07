# `agent-code-guard/no-folder-cycle`

**What it flags:** Strongly connected folder dependency components. A cycle is
reported when folders import or reexport through each other so there is no
stable dependency direction.

**Why:** Folder names should encode knowledge direction. If `app`, `network`,
`services`, and `db` all depend on each other, they are not separate
abstractions; they are one coupled module spread across folders.

## Before (flagged)

```ts
// src/app/server.ts
import { send } from "../network/send";

// src/network/send.ts
import { AppHost } from "../app/host";
```

## After (preferred)

```ts
// src/app/server.ts
import type { NetworkPort } from "../ports/network";

// src/network/send.ts
import type { Frame } from "../protocol/frame";
```

Move shared contracts down into a shared kernel or inject dependencies from the
entrypoint.

## Options

```js
{
  "agent-code-guard/no-folder-cycle": ["warn", {
    maxFolderCycles: 0
  }]
}
```
