# Safety Rules

This folder owns rules that catch unsafe implementation shortcuts.

The rules cover unsafe cast shapes, runtime environment reads, raw SQL,
raw `throw new Error`, and untyped record casts. Hardcoded-secret
detection is delegated to `sonarjs/no-hardcoded-secrets` and
`sonarjs/no-hardcoded-passwords`, which ship in the `recommended` preset.

New rules belong here when they guard runtime safety or type-system escape
hatches rather than a particular architectural boundary.
