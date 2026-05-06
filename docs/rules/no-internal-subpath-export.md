# `agent-code-guard/no-internal-subpath-export`

**What it flags:** `package.json` exports that expose implementation-shaped
subpaths such as `./src/*`, `./internal/*`, `./utils`, `./helpers`, wildcard
exports, or too many public subpaths.

**Why:** Package exports are public API. A subpath export makes the filesystem
layout importable by consumers and turns private refactors into breaking
changes.

## Before (flagged)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./internal/*": "./dist/internal/*.js",
    "./utils": "./dist/utils/index.js"
  }
}
```

## After (preferred)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./cli": "./dist/cli.js",
    "./testing": "./dist/testing/index.js"
  }
}
```

Name public subpaths by intended consumer and contract, not by the internal
folder that happens to contain the code.

## Options

```js
{
  "agent-code-guard/no-internal-subpath-export": ["warn", {
    allowedPublicSubpaths: [".", "./cli", "./testing"],
    forbiddenSubpathSegments: ["src", "internal", "utils", "helpers"],
    maxSubpathExports: 5,
    maxWildcardExports: 0
  }]
}
```

## Exceptions

Explicitly public compatibility entrypoints are allowed by adding them to
`allowedPublicSubpaths`. Avoid adding catch-all wildcards.
