# `agent-code-guard/no-implementation-file-public-entry`

**What it flags:** Public package subpaths named after implementation patterns:
`./driver`, `./adapter`, `./handler`, `./repository`, `./service`, and similar
segments.

**Why:** Public subpaths should name the contract consumers depend on, not the
concrete design pattern currently used behind the boundary.

## Before (flagged)

```json
{
  "exports": {
    "./db/driver": "./dist/db/driver.js",
    "./handlers": "./dist/network/handlers.js"
  }
}
```

## After (preferred)

```json
{
  "exports": {
    "./storage": "./dist/storage/index.js",
    "./server": "./dist/server/index.js"
  }
}
```

## Options

```js
{
  "agent-code-guard/no-implementation-file-public-entry": ["warn", {
    implementationPathSegments: ["adapter", "handler", "service", "driver"]
  }]
}
```
