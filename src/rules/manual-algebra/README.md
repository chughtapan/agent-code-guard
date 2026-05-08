# Manual Algebra Rules

This folder owns rules that detect hand-rolled versions of common typed
algebras.

The rules cover Result/Either, Option/Maybe, tagged errors, nominal brands,
manual brand constructors, exported brand constructors, and manual enum casts.

Shared detection helpers should stay in `src/utils` only when more than one
rule family consumes them. Family-specific helpers should stay in this folder.
