# `agent-code-guard/no-public-test-helper-leak`

**What it flags:** `package.json` exports that target test infrastructure —
fixtures, factories, mock builders, test utilities, or files inside
`__tests__/`, `__fixtures__/`, `test/`, `tests/`, `test-utils/`, or
`test-support/`. The rule also catches exports of barrels that re-export
from those folders.

**Why:** Test helpers exist to make YOUR tests fast. They typically
deep-import internals, embed test-only assumptions, and have weaker
versioning discipline than production code. When they're public, consumers
will (eventually) build production code against them by accident — then
upgrade their version of your package and watch their app break in
unexpected ways.

There's also a security angle: test fixtures sometimes embed sample data
that's fine for tests but inappropriate to ship as a stable contract.

## Before (flagged)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./test-utils": "./dist/test-utils/index.js"
  }
}
```

```ts
// src/test-utils/index.ts
export * from "./server";
export * from "./fixtures";
export * from "./mock-db";
```

Anyone running `import { mockDb } from "your-package/test-utils"` is now
depending on internals that exist for your tests, not for them.

## After (preferred) — explicit testing subpath

If consumers genuinely need test helpers (e.g., your library is meant to be
mocked in their tests), give them ONE explicit testing subpath, document it
as not-production-API, and curate it deliberately:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./testing": "./dist/testing/index.js"
  }
}
```

```ts
// src/testing/index.ts — small, curated, stable across versions
export { createMockClient } from "./mock-client";
export type { MockClientOptions } from "./mock-client";
```

Document in `README.md` that `./testing` is for consumer test code, not
production. Treat it with the same versioning discipline as the main public
API.

## After (preferred) — keep helpers internal

Most test helpers don't need to be public at all. If they only support YOUR
tests, leave them inside `tests/` (not `src/`) and don't put them in
`exports`:

```
package.json:
  "exports": {
    ".": "./dist/index.js"
  },
  "files": ["dist", "docs", "README.md", "LICENSE"]
  // tests/ not in `files`, so npm pack ignores it
```

## How to configure

The plugin ships no default for `allowedTestPublicSubpaths`. Without
configuration the rule flags every test-shaped subpath. Recommended
starter values:

```js
{
  "agent-code-guard/no-public-test-helper-leak": ["error", {
    allowedTestPublicSubpaths: [
      { subpath: "./testing", reason: "consumer test helpers; documented as not-production-API in README §Testing" },
    ],
  }]
}
```

If you don't intentionally expose test helpers, leave this empty — the
rule then flags any `./test-utils`, `./test-support`, `./fixtures`, or
similar subpaths that slip into your `package.json` exports.

## Suppressing exceptions

`package.json` doesn't take comments, and this rule fires on the manifest,
so file-header directives don't apply. Use `allowedTestPublicSubpaths` —
each exception requires a written reason:

```js
{
  allowedTestPublicSubpaths: [
    { subpath: "./testing", reason: "consumer test helpers" },
  ],
}
```

If you find yourself adding more than one or two entries, that's a signal
to either reorganize (move helpers out of test-shaped folders) or
acknowledge that "test helpers" have become a real product surface that
needs the same care as the main API.

## Rationale

Test helpers are convenience for the package author, not a contract for the
consumer. Mixing the two creates the most painful kind of breaking change —
consumers rolled forward, your "internal" helper changed shape, their tests
break, and the blame ladder is unclear. See
[`docs/architecture-boundary-ledger.md`](../../architecture-boundary-ledger.md)
for the full public-package-surface treatment.
