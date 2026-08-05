# `agent-code-guard/require-stable-file-shell`

Requires a non-fixing, stable TypeScript file shell. Each file has exactly one JSDoc overview with exactly one non-empty `@file` tag.

Before that overview, only a byte-zero hashbang and SPDX/copyright comments are allowed. Between it and the import shell, triple-slash directives and directive-prologue string literals are allowed. Imports then form one contiguous shell.

Every bare side-effect import has a paired, immediately adjacent line-comment barrier with the same non-empty reason:

```ts
// agent-code-guard: side-effect-import-begin -- evaluation-order: registration initializes the runtime
import "./registration";
// agent-code-guard: side-effect-import-end -- evaluation-order: registration initializes the runtime
```

The comments state an evaluation-order constraint and make the import an explicit hard partition for the reviewed sorting workflow. They are not generic section comments. The rule neither fixes code nor provides suggestions.
