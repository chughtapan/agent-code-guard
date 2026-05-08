# Tooling Rules

This folder owns rules that guard the repo's quality-gate scripts.

The rules cover `package.json` lint pipelines that drop dead-code
detection (Knip) out of the default path. Tooling drift is invisible at
review time — the rule keeps it visible.

New rules belong here when they enforce a property of build, lint, test,
or release scripts rather than source code.
