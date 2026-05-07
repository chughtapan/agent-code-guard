# `agent-code-guard/no-public-test-helper-leak`

**What it flags:** Test helpers, fixtures, test-support modules, or test-like
folders exposed as public package API.

**Why:** Test helpers often deep-import internals and expose unstable setup
machinery. If they are public, consumers may build production code against test
infrastructure by accident.

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
```

## After (preferred)

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./testing": "./dist/testing/index.js"
  }
}
```

Use one explicit testing subpath and document that it is not production API.

## Options

```js
{
  "agent-code-guard/no-public-test-helper-leak": ["warn", {
    allowedTestPublicSubpaths: ["./testing"]
  }]
}
```
