# eslint-plugin-sloppy-code-guard

An opinionated ESLint plugin that flags five common "sloppy" TypeScript patterns — `async` keywords, `Promise<>` return types, `.then()` chains, silently-swallowed `catch` blocks, and `as Record<string, unknown>` casts — to nudge codebases toward [Effect](https://effect.website/)-idiomatic style. Rules are AST-accurate (no brittle regex scanning) and ship as a flat-config-ready plugin with a `recommended` preset.

## Install

```sh
pnpm add -D eslint-plugin-sloppy-code-guard
```

Peer deps: `eslint >= 9`, `typescript >= 5`.

## Flat-config usage

```js
// eslint.config.js
import sloppy from "eslint-plugin-sloppy-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts", "**/__tests__/**", "**/test-utils/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "sloppy-code-guard": sloppy },
    rules: sloppy.configs.recommended.rules,
  },
];
```

The `recommended` preset enables all five rules at `"error"` severity.

## Rules

### `sloppy-code-guard/async-keyword`
Flags the `async` keyword on any function (declarations, expressions, arrows, class methods, and object method shorthand). In Effect-first code, asynchrony is modeled by `Effect.gen` and Effect's handlers, not by sprinkling `async`/`await`.

### `sloppy-code-guard/promise-type`
Flags `Promise<...>` used as a function return type annotation. Nested uses (e.g. `Map<string, Promise<X>>`) are allowed — a codebase can still consume third-party promise-returning APIs; what we don't want is our own functions announcing `Promise<X>` as a contract. Prefer `Effect<A, E, R>`.

### `sloppy-code-guard/then-chain`
Flags any `.then(...)` method call. If you have a `Promise`, compose it with `Effect.flatMap` / `Effect.map` via `Effect.promise` or `Effect.tryPromise` rather than chaining thenables.

### `sloppy-code-guard/bare-catch`
Flags a `try`/`catch` block that either omits the caught error entirely (`} catch {`) or binds it to an underscore-prefixed name (`catch (_)`, `catch (_err)`). Silently dropping errors turns a debuggable failure into a mystery; always bind and log.

### `sloppy-code-guard/record-cast`
Flags the specific unsafe cast `as Record<string, unknown>`. This idiom typically papers over a missing schema or validation step. Decode into a typed result (Effect `Schema`, Zod, etc.) instead.

## Disable syntax (reason required)

All suppressions must carry a reason. We recommend enabling [`@eslint-community/eslint-plugin-eslint-comments`](https://www.npmjs.com/package/@eslint-community/eslint-plugin-eslint-comments) with `eslint-comments/require-description: ["error", { ignore: [] }]` so that ESLint enforces the `-- <reason>` suffix:

```ts
// eslint-disable-next-line sloppy-code-guard/async-keyword -- interop with legacy API, migration tracked in #123
async function legacyHandler() { /* ... */ }
```

Without the `-- <reason>` suffix, the `eslint-comments` rule fails and the disable is rejected at review time.

## Contributing

To add a new rule:

1. Create `src/rules/<rule-name>.ts` exporting a `TSESLint.RuleModule` via `createRule`.
2. Register it in `src/index.ts` (both the `rules` map and `configs.recommended`).
3. Add `tests/<rule-name>.test.ts` with at least 3 valid and 5 invalid cases, plus a suppression case.
4. Document the rule in this README under "Rules".
5. `pnpm build && pnpm test` must pass.

## License

MIT
