# `agent-code-guard/manual-result`

**What it flags:** reusable hand-rolled `Result` / `Either`-like unions, helper objects, and constructors.

**Why:** once a codebase starts carrying homemade `ok/error`, `left/right`, or `success/failure` wrappers, every caller has to remember a second algebra. `Either` and `Effect` already give you constructors, matching, and a typed error channel without inventing a parallel control-flow vocabulary.

## Before (flagged)

```ts
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

const Result = {
  ok: <T>(value: T) => ({ ok: true as const, value }),
  err: <E>(error: E) => ({ ok: false as const, error }),
  match: <T, E, A>(
    input: Result<T, E>,
    handlers: { readonly onOk: (value: T) => A; readonly onErr: (error: E) => A },
  ) => (input.ok ? handlers.onOk(input.value) : handlers.onErr(input.error)),
};
```

## After (preferred) — `Either`

```ts
const parsePort = (raw: string) =>
  Number.isInteger(Number(raw))
    ? Either.right(Number(raw))
    : Either.left(new InvalidPort({ raw }));

const renderPort = (raw: string) =>
  Either.match({
    onLeft: (error) => error.message,
    onRight: (port) => `:${port}`,
  })(parsePort(raw));
```

## After (preferred) — `Effect`

```ts
const parsePort = (raw: string) =>
  Number.isInteger(Number(raw))
    ? Effect.succeed(Number(raw))
    : Effect.fail(new InvalidPort({ raw }));
```

Transport/data shapes are still allowed. A response type like `{ ok: true } | { ok: false }` stays out of scope unless it grows into a reusable algebra with constructors, guards, or combinators.
