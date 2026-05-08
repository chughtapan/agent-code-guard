# `agent-code-guard/no-effect-error-coalescing`

**What it flags:** `Effect.mapError`, `Effect.catchAll`, or
`Effect.catchAllCause` callbacks that manufacture one broad wrapper error
for all incoming error variants.

**Why:** Effect's error channel is valuable because it preserves typed
failure information. Mapping every failure to `new LoadError({ cause })`
throws that information away and makes callers recover with catch-all
logic.

This rule warns because some legacy boundaries may still need a coarse
compatibility error during migration.

## Before (flagged)

```ts
const run = Effect.all([readUser, readOrg]).pipe(
  Effect.mapError((cause) => new LoadError({ cause })),
);
```

## After (preferred)

```ts
const run = Effect.all([readUser, readOrg]);

const recovered = run.pipe(
  Effect.catchTags({
    MissingUser: handleMissingUser,
    MissingOrg: handleMissingOrg,
  }),
);
```

Preserve the union or handle each tag explicitly.

## Options

The rule has no configuration.

## Disabling per-line

For a legacy boundary that genuinely needs a coarse compatibility error during migration, suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/no-effect-error-coalescing -- v1 API contract; refined when callers move to v2
const run = work.pipe(Effect.mapError((cause) => new LegacyError({ cause })));
```
