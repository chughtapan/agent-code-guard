# Effect Rules

This folder owns rules for Effect and Either usage.

The rules catch promise bridges without typed error handling, erased Effect
errors, manual Left/Right discriminant checks, broad error coalescing, and
unbounded Effect concurrency.

New rules belong here when the smell is specific to Effect, Either, or their
error-channel conventions.
