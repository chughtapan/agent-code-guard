# Utilities

This folder owns shared helpers used across multiple rule families.

Utilities must stay cohesive. If a helper is only used by one rule family, keep
it inside that family instead of adding it here. If a utility starts serving
disjoint consumer communities, split it into smaller modules or expose a
curated facade.

`create-rule.ts` is the ESLint rule factory. AST helpers and manual algebra
detection helpers live here only because several rule families share them.
