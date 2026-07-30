# Tooling Rules

This folder owns rules that guard repository tooling.

The rules cover `package.json` lint pipelines that drop dead-code detection
(Knip) from the default path. Tooling drift is invisible at review time—the
rules keep it visible.

New rules belong here when they enforce a property of build, lint, test,
or release scripts rather than source code.
