# `agent-code-guard/require-knip-in-lint`

**What it flags:** `package.json` default quality scripts (e.g. `lint`)
that do not run Knip.

**Why:** dead-code detection is only useful when it stays in the routine
lint path. If Knip is a separate optional command, stale files, unused
exports, and unused dependencies survive routine agent edits and accumulate
silently.

This rule is an error: tooling drift in the default script is invisible
at review time, and the cost to wire it back in is one shell `&&`.

## Before (flagged)

```json
{
  "scripts": {
    "lint": "eslint ."
  }
}
```

## After (preferred)

```json
{
  "scripts": {
    "lint": "eslint . && knip"
  }
}
```

`agent-code-guard` also exposes an `agent-code-guard-knip` bin, so
downstream packages can use that command explicitly if they want to
avoid depending on a direct `knip` installation.

## Options

```js
{
  "agent-code-guard/require-knip-in-lint": ["error", {
    // package.json file to inspect. Defaults to <eslint cwd>/package.json.
    packageJsonPath: "package.json",

    // Scripts that may act as the default quality gate. Default: ["lint"].
    scriptNames: ["lint"],
  }]
}
```

## Disabling per-line

This rule reports at the file's `Program` node (the diagnostic is about
`package.json` content, not a specific source line), so
`eslint-disable-next-line` does not apply. Disable the rule at the file
or config level instead:

```js
// eslint.config.js
rules: {
  ...guard.configs.recommended.rules,
  // Repo gates dead-code via a separate `pnpm knip:full` workflow run;
  // the default `lint` script intentionally stays narrow.
  "agent-code-guard/require-knip-in-lint": "off",
}
```

Re-disable in source by name:

```ts
/* eslint-disable agent-code-guard/require-knip-in-lint -- repo runs knip in a dedicated workflow */
```

The reason is required by `eslint-comments/require-description`.
