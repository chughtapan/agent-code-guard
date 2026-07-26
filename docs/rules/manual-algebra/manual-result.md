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

## Consuming an Either is never flagged

The rule looks for a *definition* of a success/failure algebra. Reads qualified by a namespace-style receiver — `Either.left(e)`, `Either.right(v)`, `Either.match(...)` — are uses, so they contribute nothing to detection however densely a function calls them:

```ts
function decode(raw: string) {
  const parsed = Either.isLeft(read(raw)) ? Either.left("bad") : Either.right(raw);
  return Either.match(parsed, { onLeft: (error) => error, onRight: (value) => value });
}
```

Lower-cased receivers still count, because `result.ok` and `result.error` are evidence of a shape being taken apart by hand rather than delegated to a library.

## Disabling per-line

If the union is intentionally hand-rolled at a boundary (e.g., a wire-format response type that must match a JSON contract), suppress with a written reason:

```ts
// eslint-disable-next-line agent-code-guard/manual-result -- wire format dictated by external API
type Result<T, E> = { _tag: "Ok"; value: T } | { _tag: "Err"; error: E };
```
