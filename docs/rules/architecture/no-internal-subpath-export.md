# `agent-code-guard/no-internal-subpath-export`

**What it flags:** `package.json` `exports` map entries that expose
implementation-shaped subpaths. Specifically:

- Exports targeting `./src/*`, `./internal/*`, `./private/*`, `./impl/*`,
  `./helpers/*`, `./utils/*`, `./shared/*`, `./adapters/*`,
  `./__generated__/*`, `./__fixtures__/*`, `./__tests__/*`, etc.
- Wildcard exports (`"./*": "..."`) that expose anything-the-filesystem-has.
- Too many subpath exports — by default, more than five is flagged
  (configurable via `maxSubpathExports`).

The forbidden segment list is configurable; defaults catch the common
"private folder leaked into public API" mistakes.

**Why:** `package.json` exports are public API. A subpath export turns the
filesystem layout into a contract — every internal refactor that moves a file
becomes a breaking change. Worse, consumers can build production code against
helpers and fixtures that were never meant to be stable.

## Before (flagged)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./internal/*": "./dist/internal/*.js",
    "./utils": "./dist/utils/index.js",
    "./helpers/*": "./dist/helpers/*.js",
    "./*": "./dist/*.js"
  }
}
```

Now `import { thing } from "your-package/internal/cache"` works, and you can
never refactor `internal/cache.ts` again.

## After (preferred) — name public subpaths by contract

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./cli": "./dist/cli.js",
    "./testing": "./dist/testing/index.js"
  }
}
```

Every subpath names what consumers depend on (`cli`, `testing`), not where
the code happens to live (`internal`, `utils`, `helpers`). When you move
`dist/cli.js` to `dist/commands/main.js`, the public name `./cli` doesn't
change.

## After (preferred) — single root export, opinionated facade

For libraries with one clear entry point:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

Consumers get exactly one place to import from. Anything they need is
re-exported from `index.ts` deliberately.

## How to configure

The plugin ships no defaults for `forbiddenSubpathSegments` or
`allowedPublicSubpaths`. Without configuration the rule is dormant.
Recommended starter values:

```js
{
  "agent-code-guard/no-internal-subpath-export": ["error", {
    // Subpaths that ARE part of the public contract. Reasons are required;
    // bare strings are rejected by the schema. Pick what's actually public
    // for your package.
    allowedPublicSubpaths: [
      { subpath: ".", reason: "primary entrypoint" },
      { subpath: "./cli", reason: "CLI invocation contract" },
      { subpath: "./testing", reason: "consumer test helpers; documented in README §Testing" },
    ],

    // Path segments that mark a target as private. Bare strings (no
    // reason needed) — adding an entry makes the rule stricter, which
    // is the whole point.
    forbiddenSubpathSegments: [
      "src", "internal", "private", "impl", "implementation",
      "utils", "helpers", "lib", "shared", "common", "adapters",
      "__generated__", "__fixtures__", "__tests__",
    ],

    maxSubpathExports: 5,
    maxWildcardExports: 0,
  }]
}
```

## Suppressing exceptions

`package.json` doesn't accept comments, and this rule fires on the package
manifest itself rather than a source file, so file-header directives don't
apply. Use `allowedPublicSubpaths` instead — each exception requires a
written reason:

```js
{
  allowedPublicSubpaths: [
    { subpath: ".", reason: "primary entrypoint" },
    { subpath: "./cli", reason: "CLI invocation contract" },
    { subpath: "./testing", reason: "consumer test helpers" },
    { subpath: "./compat", reason: "pre-1.0 compat shim; remove after Q3 deprecation cycle" },
  ],
}
```

The reason field is the architectural acknowledgment — it documents intent
for future maintainers and shows up in config review.

## Rationale

`package.json` exports are the most binding contract a package has — they're
what `npm install` users hit before they read your README. See
[`docs/architecture-boundary-ledger.md`](../../architecture-boundary-ledger.md)
for the full package-level boundary treatment.
