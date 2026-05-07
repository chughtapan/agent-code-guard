# `agent-code-guard/no-package-mesh`

**What it flags:** Dense, cyclic package folder graphs. The rule combines folder
count, folder edge density, and cycle groups.

**Why:** A package with many folders and many bidirectional edges has no clear
dependency direction. Folder names stop representing boundaries; the package is
one coupled module.

## Before (flagged)

```text
app -> services -> network -> app
services -> db -> app
task -> services -> ws -> network -> task
```

## After (preferred)

```text
entrypoint -> app -> ports
entrypoint -> adapters -> ports
services -> domain -> shared-kernel
```

Composition points depend outward; domain and shared-kernel code do not import
back into concrete adapters.

## Options

```js
{
  "agent-code-guard/no-package-mesh": ["warn", {
    minPackageMeshFolders: 6,
    maxFolderEdgeDensity: 0.35,
    maxFolderCycles: 0
  }]
}
```
