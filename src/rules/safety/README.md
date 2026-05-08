# Safety Rules

This folder owns rules that catch unsafe implementation shortcuts.

The rules cover unsafe cast shapes, runtime environment reads, hardcoded
secrets, raw SQL, raw `throw new Error`, and untyped record casts.

New rules belong here when they guard runtime safety or type-system escape
hatches rather than a particular architectural boundary.
