# Async Flow Rules

This folder owns rules that make async control flow and optional inputs
explicit.

The rules catch raw promises, `async` functions, `.then` chains, bare catches,
unbounded concurrency, and nullable parameters that continue through a call
graph unresolved.

New rules belong here when they reason about control flow shape rather than a
specific library API.
