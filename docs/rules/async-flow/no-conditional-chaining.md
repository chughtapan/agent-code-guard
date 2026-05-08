# `agent-code-guard/no-conditional-chaining`

**What it flags:** functions that forward an optional or nullable
parameter to another call without first resolving it (an early-return
guard, default coalesce, or local shadow).

**Why:** once a function accepts `id?: string` and passes that `id`
straight to `fetchUser(id)`, every downstream call has to keep carrying
the unresolved uncertainty or sprinkle in defensive checks. The
uncertainty should be resolved at the boundary; everything past the
boundary should receive a concrete value.

This rule warns because moving the parsing/normalization to the edge of
the workflow is real migration work.

## Before (flagged)

```ts
function loadUser(id?: string) {
  return fetchUser(id);
}
```

`id` is forwarded to `fetchUser` without ever being checked. The
downstream code has to handle the optional case again.

## After (preferred)

Resolve at the boundary, then forward a concrete value:

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
`normalize*`, `resolve*`, `read*`, `from*`) may accept unresolved inputs
without flagging — that is their job.

## Allowed: in-function resolution

The rule treats the parameter as resolved when it sees, before the
forwarding call, any of:

- An early-return / early-throw guard:
  `if (id === undefined) return ...;` or `throw ...;`
- A coalescing assignment back into the parameter: `id ??= "default";`
- A `const`/`let` shadow that hides the parameter name.

Any of these is enough — the rule is not flagging the optional declaration
itself, only the forward-without-resolve pattern.

```ts
function loadUser(id?: string) {
  if (id === undefined) return Effect.fail(new MissingUserIdError());
  return fetchUser(id);
}
```

```ts
function loadUser(id?: string) {
  id ??= "anonymous";
  return fetchUser(id);
}
```

```ts
function loadUser(id?: string) {
  const resolved = id ?? "anonymous";
  return fetchUser(resolved);
}
```

All three pass.

## Options

The rule has no configuration. Boundary-named function prefixes are the
allowed exception.

## Disabling per-line

If a function legitimately forwards an unresolved parameter outside a
parser/normalizer boundary (e.g., a default-handler shim during a
migration), suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/no-conditional-chaining -- shim during v2 migration; remove after callers move to UserId
function loadUser(id?: string) {
  return fetchUser(id);
}
```
