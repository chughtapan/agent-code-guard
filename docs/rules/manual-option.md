# `agent-code-guard/manual-option`

**What it flags:** reusable hand-rolled `Option` / `Maybe`-like unions, helper objects, and constructors.

**Why:** `Some` / `None` wrappers only help if the whole codebase handles them consistently. `Option` already gives you the constructors and matches; a local `Maybe` or `Option` clone creates a second absence model and pushes callers back toward manual `_tag` checks.

## Before (flagged)

```ts
type Option<T> =
  | { readonly _tag: "Some"; readonly value: T }
  | { readonly _tag: "None" };

const Option = {
  some: <T>(value: T) => ({ _tag: "Some" as const, value }),
  none: { _tag: "None" as const },
  match: <T, A>(
    input: Option<T>,
    handlers: { readonly onSome: (value: T) => A; readonly onNone: () => A },
  ) => (input._tag === "Some" ? handlers.onSome(input.value) : handlers.onNone()),
};
```

## After (preferred)

```ts
const findSession = (id: SessionId) =>
  cache.has(id) ? Option.some(cache.get(id)!) : Option.none();

const renderSession = (id: SessionId) =>
  Option.match({
    onSome: (session) => session.userName,
    onNone: () => "missing",
  })(findSession(id));
```

Domain-state unions and transport wrappers stay allowed when they are just data. This rule is about reusable maybe-value control-flow helpers, not every `_tag` union in the codebase.
