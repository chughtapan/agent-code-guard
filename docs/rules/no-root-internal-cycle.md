# `agent-code-guard/no-root-internal-cycle`

**What it flags:** Root/public files and `internal` files importing through each
other.

**Why:** `internal` exists to hide implementation decisions from the public/root
surface. If internal code imports the root facade, the private layer depends on
the public layer that is supposed to hide it.

## Before (flagged)

```ts
// src/index.ts
export { makeClient } from "./internal/client";

// src/internal/client.ts
import { VERSION } from "../index";
```

## After (preferred)

```ts
// src/version.ts
export const VERSION = "1";

// src/index.ts
export { VERSION } from "./version";
export { makeClient } from "./internal/client";

// src/internal/client.ts
import { VERSION } from "../version";
```

Move shared values below both layers or inject them from the entrypoint.
