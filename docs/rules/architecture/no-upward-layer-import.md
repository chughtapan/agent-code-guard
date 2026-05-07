# `agent-code-guard/no-upward-layer-import`

**What it flags:** Lower-level files importing parent or root facades.

**Why:** A child folder importing a parent/root index usually reverses
dependency direction. Lower-level implementation files should depend on narrow
contracts below or beside them, not the facade assembled above them.

## Before (flagged)

```ts
// src/db/client.ts
import { logger } from "../index";
```

## After (preferred)

```ts
// src/db/client.ts
import type { LoggerPort } from "../ports/logger";
```

Move shared contracts into a lower-level module, or inject concrete
dependencies from the composition root.

## Exceptions

If a root-level file is actually a shared kernel, move it into a named shared
folder or add that folder to `sharedFolderNames`.
