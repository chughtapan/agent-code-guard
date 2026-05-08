# `agent-code-guard/no-fat-orchestrator`

**What it flags:** A non-entry-point file that imports from many modules (≥ 15), is imported by at most one consumer, and has a substantive body of its own (≥ 20 top-level statements). The shape says: "this file wires a lot of things together but isn't an entry point and isn't really used by anyone — it grew its own logic instead of staying a thin wiring layer."

**Why:** Effective orchestrators stay thin. When a non-entry file accumulates 20+ imports and 20+ top-level declarations of its own, it has stopped being an orchestrator and become a kitchen sink. Splitting it into focused submodules:

- Reduces the explosion surface (a change to any imported module no longer cascades through one giant file).
- Makes the file's purpose namable.
- Makes it easier to test the individual concerns in isolation.

The rule deliberately excludes entry points (index, main, cli, public surface, files under `cli/` or `bin/`, `*.config.*` files) because *those* are the legitimate places for fat wiring.

## Before (flagged)

`src/feature/orchestrator.ts` — 18 imports, 25 top-level statements, 0 importers (or 1 wrapper):

```ts
import { ServiceA } from "./service-a.js";
import { ServiceB } from "./service-b.js";
// ... 16 more imports

const configA = ServiceA.create({ /* ... */ });
const configB = ServiceB.create({ /* ... */ });
// ... 23 more declarations

export const start = () => {
  // big runtime wiring + business logic mixed together
};
```

## After (preferred)

Split by concern:

```
src/feature/
  config/
    index.ts        // 5 imports, builds ConfigA + ConfigB + …
  pipeline/
    index.ts        // 4 imports, wires the pipeline stages
  start.ts          // 3 imports: { Config, Pipeline, Logger } — thin
```

Or, if it really is the entry point, mark it as one (move under `cli/`, name it `index.ts`, or expose it via the package's public surface).

## Thresholds (defaults)

- **Fan-out** (imports): ≥ 15
- **Fan-in** (unique consumer files): ≤ 1
- **Top-level statements** (excluding imports): ≥ 20

These were calibrated against ESLint's `lib/linter/linter.js` (27 imports, 36 top-level statements, 891-LOC class) and tightened to catch files that are *starting* to drift, not just the worst offenders.

## Exempted shapes

The rule does not fire on:

- `index.ts` files at any depth
- Files marked as public package surface
- Files under `cli/` or `bin/` directories
- Files named `cli.ts`, `main.ts`
- Files matching `*.config.*` (vite.config.ts, tsup.config.ts, etc.)
- Test-like files

## Pairing

- `no-trivial-sink-file` — the dual: small file with one consumer that should be inlined.
- `shared-kernel-cohesion` — flags wide shared modules whose exports are consumed by mostly disjoint callers.
- SonarJS `S104` (max-lines-per-file) — orthogonal: handles raw size; this rule handles wiring density specifically.

## Suppression

```ts
/* @agent-code-guard/architecture-exception:
   no-fat-orchestrator
   reason: declared as the package's runtime composition root, not split for {documented reason}
*/
```
