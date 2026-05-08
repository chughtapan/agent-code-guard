# `agent-code-guard/acquire-release-requires-scope`

**What it flags:** A call to `Effect.acquireRelease` or `Effect.acquireUseRelease` in a file that never references `Effect.scoped`, `Layer.scoped`, or `scopedDiscard`. Without an enclosing scope frame the resource never releases.

**Why:** `Effect.acquireRelease(open, close)` returns an Effect with a `Scope` requirement. The runtime's contract is "give me a scope and I'll guarantee `close` runs when the scope closes." If you never wrap that Effect in `Effect.scoped` (or compose it through a `Layer.scoped`), the requirement just propagates upward forever — the resource opens but the close hook has nothing to attach to.

The rule's check is structural and file-scoped: if the file has any `scoped` reference, the rule trusts you. If it has none, every `acquireRelease` in the file is flagged.

## Before (flagged)

```ts
import { Effect } from "effect";

const program = Effect.acquireRelease(
  Effect.sync(() => openHandle()),
  (handle) => Effect.sync(() => handle.close()),
); // Scope required, never provided
```

## After (preferred)

```ts
import { Effect } from "effect";

const acquired = Effect.acquireRelease(
  Effect.sync(() => openHandle()),
  (handle) => Effect.sync(() => handle.close()),
);

const program = Effect.scoped(
  Effect.gen(function* () {
    const handle = yield* acquired;
    return yield* useHandle(handle);
  }),
);
```

Or compose at the layer level:

```ts
const HandleLayer = Layer.scoped(
  HandleTag,
  Effect.acquireRelease(
    Effect.sync(() => openHandle()),
    (handle) => Effect.sync(() => handle.close()),
  ),
);
```

## What counts as "has a scope frame"

The literal token `scoped` (or `scopedDiscard`) appearing in any of:

- `Effect.scoped(...)`, `Layer.scoped(...)`
- `import { scoped } from "effect"` and `scoped(...)`

If you've imported and aliased differently, scope this rule via flat-config files glob.

## Pairing

- `runpromise-requires-scoped` (typed) — flags running an Effect that requires Scope without `Effect.scoped`. Catches the runtime side; this rule catches the source side.
- `finalizer-requires-scope` — flags `Scope.addFinalizer` calls without scope frames.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/acquire-release-requires-scope -- caller wraps in Effect.scoped; this module is reusable across topologies
const acquired = Effect.acquireRelease(open, close);
```
