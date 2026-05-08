# `agent-code-guard/no-package-mesh`

**What it flags:** Folder dependency graphs that have crossed multiple
"this is a mesh, not a layered architecture" thresholds: enough folders
(`minPackageMeshFolders`), enough cross-folder edges
(`maxFolderEdgeDensity`), and any cycles (`maxFolderCycles`).

Defaults: 6+ folders, 35%+ edge density, any cycle → flagged.

**Why:** A package with many folders and dense bidirectional dependencies
has no clear knowledge direction. Folder names stop representing
boundaries; the package becomes one coupled module spread across many
files. Adding a feature requires touching many folders; reading code
requires holding the entire graph in your head.

This rule warns because the right shape depends on the package's
purpose. A monolithic application legitimately has more cross-folder
edges than a focused library. Tune the thresholds to your context.

## Before (flagged)

```text
src/
├── app/         → services, network
├── services/    → app, db, network
├── network/     → app, services
├── db/          → services, app
├── ws/          → network, services
└── task/        → services, ws, network
```

Edge density: 12 cross-folder edges across 15 possible pairs ≈ 80%. Three
cycles (`app ↔ services`, `services ↔ db`, `network ↔ services`).

Every folder is a peer of every other folder. There's no layered design —
just six things in a coupled bag.

## After (preferred) — entrypoint-driven layering

Restructure so dependency direction flows one way: entrypoint → composition
→ domain → shared kernel.

```text
src/
├── index.ts                    (entrypoint)
├── app/         → ports        (composition layer)
├── adapters/
│   ├── network/ → ports
│   ├── db/      → ports
│   └── ws/      → ports
├── domain/
│   ├── services/ → domain types, shared-kernel
│   └── task/     → domain types, shared-kernel
├── ports/                      (contracts, no upward deps)
└── shared-kernel/              (utilities, no upward deps)
```

Now reading `services/` only requires reading `domain/`, `ports/`, and
`shared-kernel/`. Adapters only depend on ports. The composition root
wires concrete adapters to domain services.

## After (preferred) — split into multiple packages

When the mesh is genuinely multiple products, split:

```
packages/
├── core/          (shared kernel, ports, domain types)
├── app-server/    (composition + adapters for the server use-case)
├── app-cli/       (composition + adapters for the cli use-case)
└── plugins-foo/   (a plugin that depends on core only)
```

Each package has its own dependency graph; the inter-package boundaries
are explicit `package.json` exports.

## Options

```js
{
  "agent-code-guard/no-package-mesh": ["warn", {
    // Minimum folder count before the rule even considers firing. Below
    // this, even a fully-connected graph is fine — it's just a small repo.
    // Default: 6.
    minPackageMeshFolders: 6,

    // Acceptable ratio of cross-folder edges to all possible folder
    // pairs. 0.35 ≈ "any folder may depend on a third of the others."
    // Above this is mesh territory. Default: 0.35.
    maxFolderEdgeDensity: 0.35,

    // Maximum acceptable cycle groups. Default: 0 — any cycle pushes you
    // toward mesh territory.
    maxFolderCycles: 0,
  }]
}
```

## Suppressing exceptions

This rule fires on the package as a whole, not on a specific file, so
file-header directives don't apply. Tune the thresholds if your package
genuinely has higher acceptable density:

```js
{
  "agent-code-guard/no-package-mesh": ["warn", {
    minPackageMeshFolders: 6,
    maxFolderEdgeDensity: 0.5,  // we're a CLI tool with deliberate utility-graph density
    maxFolderCycles: 0,
  }]
}
```

If you raise `maxFolderEdgeDensity` above 0.5, double-check the graph —
that's typically a sign the design is mesh-shaped. The rule is meant to
catch accidental mesh, not punish deliberate dense packages.

## Rationale

Mesh-shaped packages compound debt — every new feature adds edges, every
edge adds reading complexity. The rule's job is to catch the transition
point before the graph becomes impossible to refactor.
