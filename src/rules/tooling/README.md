# Tooling Rules

This folder owns rules that guard the repo's quality-gate scripts.

The rules cover `package.json` lint pipelines that drop dead-code detection
(Knip) or TypeScript checking from the default path, and validate the explicit
compiler-option floor needed by typed lint. Tooling drift is invisible at
review time—the rules keep it visible.

New rules belong here when they enforce a property of build, lint, test,
or release scripts rather than source code.
