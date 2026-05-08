# `agent-code-guard/no-conditional-chaining`

**What it flags:** functions that accept optional or nullable parameters
outside explicit parser/normalizer boundaries.

**Why:** once a function accepts `id?: string`, every downstream call has
to either keep carrying unresolved uncertainty or add defensive checks. The
uncertainty should be resolved at the boundary, then the rest of the call
graph should receive a concrete value.

This rule warns because migration usually requires moving parsing logic to
the edge of the workflow.

## Before (flagged)

```ts
function loadUser(id?: string) {
  if (id === undefined) return Effect.fail(new MissingUserIdError());
  return fetchUser(id);
}
```

The guard is still a smell: `loadUser` should not have received an
unresolved id.

## After (preferred)

```ts
function parseUserId(id?: string) {
  if (id === undefined) return Effect.fail(new MissingUserIdError());
  return UserId(id);
}

function loadUser(id: UserId) {
  return fetchUser(id);
}
```

Functions named like parser/normalizer boundaries (`parse*`, `decode*`,
`normalize*`, `resolve*`, `read*`, `from*`) may accept unresolved inputs —
that is their job.

## Options

The rule has no configuration. Boundary-named function prefixes are the
allowed exception.

## Disabling per-line

If a function legitimately accepts an optional input outside a parser/normalizer boundary (e.g., a default-handler shim during migration), suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/no-conditional-chaining -- shim during v2 migration; remove after callers move to UserId
function loadUser(id?: string) { ... }
```
