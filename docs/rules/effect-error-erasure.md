# `agent-code-guard/effect-error-erasure`

**What it flags:** `Effect.fail(new Error(...))` and `Effect.mapError(() => new Error(...))`.

**Why:** wrapping failures in a generic `Error` erases the domain signal you need for precise recovery. Once every failure becomes `Error`, downstream code can no longer `catchTag(...)` or exhaustively distinguish real cases.

## Before (flagged)

```ts
return yield* Effect.fail(new Error("HTTP 500"));
```

```ts
program.pipe(Effect.mapError(() => new Error("reconnect failed")));
```

## After (preferred)

```ts
return yield* Effect.fail(
  new HttpResponseError({ status: 500, body: responseBody }),
);
```

```ts
program.pipe(
  Effect.mapError((cause) => new ReconnectFailedError({ cause })),
);
```

Generic `Error` is fine at the true process edge. Inside an Effect error channel, keep failures typed.
