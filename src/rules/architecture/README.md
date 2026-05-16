# Architecture Rules

This folder owns graph-backed architecture diagnostics. These rules analyze
the whole TypeScript project, not only the currently linted file.

The implementation is organized by analysis surface:

- `exports/` inspects index and public export curation.
- `folder-shape/` inspects folder size, README, and facade pressure.
- `imports/` builds and analyzes local import topology.
- `module-shape/` inspects accidental boundary modules and shared kernels.
- `package-api/` inspects `package.json` public entries.
- `project/` builds the source model, config, cache, and diagnostic contracts.
- `type-surface/` inspects public API type ownership.

`index.ts` is the architecture analyzer facade. `plugin-rules.ts` adapts
architecture diagnostics into individual ESLint rules and presets.

## Performance

The architecture analyzer runs once per project and is cached. The cache
TTL defaults to 5 seconds so long-lived hosts (ESLint LSP, VS Code) see
fixes promptly. CI lints finish in one pass, so a longer TTL is safe:

```js
const ARCHITECTURE_OPTIONS = {
  // …
  cacheTtlMs: Infinity, // CI: never rebuild within a single lint run
};
```

Valid range: `0` (always rebuild) through `Infinity`.
