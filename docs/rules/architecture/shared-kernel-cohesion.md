# `agent-code-guard/shared-kernel-cohesion`

**What it flags:** Shared helper files whose exported symbols are consumed
by mostly disjoint production modules.

Default: 6+ production-consumed exports, 4+ production consumers total, and
median pairwise consumer overlap below 0.25.

**Why:** A shared kernel is allowed to have high fan-in, but its exports
should serve the same consumer community. If one export is only used by
rules, another only by graph code, and another only by algebra detection,
the file is not cohesive; it is several modules sharing a filename.

This rule warns because cohesion is a design smell, not always a bug. It
is the implementation of the ledger check `folder/shared-kernel-cohesion`.

## Before (flagged)

```ts
// src/utils/ast-refinement.ts
export function getStaticStringKey() {}
export function getStringLiteralValue() {}
export function getParent() {}
export function isNamedMemberCall() {}
export function effectCallName() {}
export function assertionLiteral() {}
```

If those exports are used by mostly different production files, the helper
is acting as a junk drawer.

## After (preferred)

```text
src/utils/
├── ast-strings.ts
├── ast-parents.ts
├── effect-calls.ts
└── assertion-literals.ts
```

Each helper module now has one consumer community and one reason to
change.

## Options

```js
{
  "agent-code-guard/shared-kernel-cohesion": ["warn", {
    // Sample-size guards. They prevent tiny modules from reporting; they
    // are not the architectural signal.
    minSharedKernelExports: 6,
    minSharedKernelConsumers: 4,

    // Pairwise Jaccard overlap between export consumer sets. Lower values
    // mean exports are used by different communities. Default: 0.25.
    maxSharedKernelMedianOverlap: 0.25,
  }]
}
```

`index.ts` facades, configured `facadeFiles`, test files, and generated
files are ignored.

## Suppressing per-file via a directive

```ts
// @agent-code-guard/architecture-exception: shared-kernel-cohesion
// reason: this is a deliberate compatibility surface for legacy consumers
```

The `reason:` line is required.
