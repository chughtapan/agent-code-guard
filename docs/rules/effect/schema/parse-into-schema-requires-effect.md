# `agent-code-guard/parse-into-schema-requires-effect`

**What it flags:** A call to `Schema.decode*(...)(...)` whose argument is `JSON.parse(...)` and whose enclosing function is **not** the thunk passed to `Effect.try` / `Effect.tryPromise`. The decoder is on the Effect channel, but `JSON.parse` runs outside it, so a malformed input throws a `SyntaxError` straight past the Effect runtime.

**Why:** `JSON.parse` throws on bad input. `Schema.decodeUnknown` returns a `ParseError` in the Effect's typed error channel. Putting them next to each other looks like the failure modes are paired, but they aren't:

- Bad JSON → `JSON.parse` throws synchronously, **outside** the Effect's reach.
- Valid JSON but wrong shape → `Schema.decodeUnknown` returns a `ParseError` in the Effect channel.

The first one bypasses your error handlers, span annotations, retry policies, and structured logging because it never made it into an Effect to begin with. Wrap the parse so both failure modes flow through the same channel.

## Before (flagged)

```ts
const program = Schema.decodeUnknown(UserSchema)(JSON.parse(input));
// SyntaxError from JSON.parse escapes; ParseError from decoder is on the Effect channel.
```

```ts
const user = Schema.decodeUnknownSync(UserSchema)(JSON.parse(input));
// Both throw, but at different layers. Co-fires with prefer-decode-effect-at-boundary.
```

## After (preferred)

```ts
const program = Effect.gen(function* () {
  const parsed = yield* Effect.try(() => JSON.parse(input));
  const user = yield* Schema.decodeUnknown(UserSchema)(parsed);
  return user;
});
```

Or, pipe-style:

```ts
const program = pipe(
  Effect.try(() => JSON.parse(input)),
  Effect.flatMap(Schema.decodeUnknown(UserSchema)),
);
```

Both versions put the `JSON.parse` failure (`UnknownException` from `Effect.try`) and the decode failure (`ParseError`) into the same Effect's error channel.

## What's exempt

The rule **does not fire** when the entire `Schema.decode*(...)(JSON.parse(...))` chain is inside an arrow function or function expression that was passed to `Effect.try` or `Effect.tryPromise`:

```ts
// Allowed — the throwable JSON.parse is wrapped
const program = Effect.try(() =>
  Schema.decodeUnknownSync(UserSchema)(JSON.parse(input)),
);
```

That form is sometimes a reasonable shortcut: it captures both throws as a single `UnknownException` so the call site only has one failure mode to handle. The rule trusts the wrapper.

## Pairing

- `prefer-decode-effect-at-boundary` — kin of this rule. Prefers `Schema.decodeUnknown` (Effect-returning) over `decodeUnknownSync` for I/O-shaped inputs. Co-fires when both are violated together.
- `no-schema-type-cast` — catches the *no-decoder-at-all* anti-pattern (just casting the JSON.parse result).

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/parse-into-schema-requires-effect -- migration script; bad input should crash loudly
const config = Schema.decodeUnknownSync(ConfigSchema)(JSON.parse(input));
```
