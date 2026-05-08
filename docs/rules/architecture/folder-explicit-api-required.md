# `agent-code-guard/folder-explicit-api-required`

**What it flags:** A folder consumed by outside code through multiple
concrete files instead of one semantic folder API.

Default: 2+ concrete files imported from outside the folder, unless the
same consumers also import an `index.ts` in that folder or a non-index file
listed in `facadeFiles`.

**Why:** A folder boundary should hide a design decision. When outside
code imports `src/foo/a.ts`, `src/foo/b.ts`, and `src/foo/c.ts`, the folder
has no stable API; consumers know the implementation layout. Rename or
split any internal file and every consumer changes.

This rule warns because folder APIs are architectural judgment calls. It
is the implementation of the ledger check `folder/explicit-api-required`.

## Before (flagged)

```ts
// src/app/use-widgets.ts
import { A } from "../widgets/a";
import { B } from "../widgets/b";
import { C } from "../widgets/c";
```

`src/widgets` is being consumed as a filesystem inventory.

## After (preferred)

```ts
// src/widgets/index.ts
export { createWidgetSet } from "./create-widget-set";
export type { WidgetSpec } from "./types";

// src/app/use-widgets.ts
import { createWidgetSet } from "../widgets";
```

The consumer depends on the semantic API, not on the internal file layout.

## Options

```js
{
  "agent-code-guard/folder-explicit-api-required": ["warn", {
    // Concrete files inside one folder/subtree imported from outside before
    // the rule reports. Default: 2.
    minExplicitApiConcreteFiles: 2,

    // Folders listed here are treated as declared shared kernels and are
    // ignored by this rule. Each entry requires a written reason.
    sharedFolderNames: [
      { folder: "shared", reason: "package-wide stable contracts" },
    ],

    // Non-index facade files must be declared explicitly. Paths are
    // relative to src; each entry requires a written reason.
    facadeFiles: [
      { file: "widgets/api.ts", reason: "stable widget folder API" },
    ],
  }]
}
```

Test-like and generated files are ignored automatically.

## Suppressing per-file via a directive

```ts
// @agent-code-guard/architecture-exception: folder-explicit-api-required
// reason: migration shim; concrete imports removed after the v2 facade lands
```

The `reason:` line is required.
