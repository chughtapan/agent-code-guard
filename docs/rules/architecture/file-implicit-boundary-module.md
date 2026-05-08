# `agent-code-guard/file-implicit-boundary-module`

**What it flags:** A non-facade file that behaves like a boundary: several
production files depend on it, it depends on several implementation files,
and it exports multiple names.

Default: 2+ production incoming files, 2+ outgoing implementation files,
and 2+ exported names.

**Why:** This is the "accidental facade" shape. The file is already a
boundary, but its name and location do not say so. Callers start treating a
concrete implementation file as the stable API, while that file keeps
learning about implementation helpers.

This rule warns because some orchestration files are intentionally shaped
this way. It is the implementation of the ledger check
`file/implicit-boundary-module`.

## Before (flagged)

```ts
// src/architecture/project-graph.ts
import { collectEdges } from "./project-graph-edges";
import { collectPublicApi } from "./project-graph-public";

export { buildProjectGraph, resolveLocalSpecifier };
```

Callers depend on `project-graph.ts`, and `project-graph.ts` depends on a
cluster of implementation helpers.

## After (preferred)

```text
src/architecture/project-graph/
├── index.ts     # stable facade
├── edges.ts     # private implementation
├── public.ts    # private implementation
└── folders.ts   # private implementation
```

The facade names the contract. Helpers stay private.

## Options

```js
{
  "agent-code-guard/file-implicit-boundary-module": ["warn", {
    minImplicitBoundaryIncomingFiles: 2,
    minImplicitBoundaryOutgoingFiles: 2,
    minImplicitBoundaryExports: 2,

    // Non-index facade files must be declared explicitly. Paths are
    // relative to src; each entry requires a written reason.
    facadeFiles: [
      { file: "architecture/project-graph/api.ts", reason: "stable project graph API" },
    ],
  }]
}
```

`index.ts` is treated as a facade by convention. No other filename is
guessed; non-index facades must be listed in `facadeFiles`.

## Suppressing per-file via a directive

```ts
// @agent-code-guard/architecture-exception: file-implicit-boundary-module
// reason: this orchestrator is deliberately the stable API for the package
```

The `reason:` line is required.
