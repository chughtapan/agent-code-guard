# `safer-by-default/promise-type`

**What it flags:** `Promise<...>` used as a function **return type annotation**. Nested uses (e.g. `Map<string, Promise<X>>`) are allowed — you still consume third-party promise-returning APIs.

**Why:** Your own functions should announce `Effect<A, E, R>` as their contract, not `Promise<A>`. A `Promise<A>` erases the error channel (errors become untyped exceptions) and the requirements channel (dependencies become implicit). An `Effect<A, E, R>` encodes all three, which is why the rest of the codebase can compose with it cleanly.

## Before (flagged)

```ts
function fetchUser(id: string): Promise<User> {
  return http.get(`/users/${id}`).then((r) => r.json());
}
```

## After (preferred)

```ts
import { Effect } from "effect";

const fetchUser = (id: string): Effect.Effect<User, FetchError, HttpClient> =>
  HttpClient.get(`/users/${id}`).pipe(
    Effect.flatMap((r) => Effect.tryPromise({ try: () => r.json(), catch: (e) => new FetchError({ cause: e }) })),
  );
```

Notes for agents:
- Identify the errors your function can produce and encode them in the `E` channel of `Effect.Effect<A, E, R>`.
- Identify the services it needs (db, http client, config) and encode them in the `R` channel.
- If the function wraps a single `Promise`-returning call, use `Effect.tryPromise`.

## Exceptions

Exporting a library surface that must match a promise-based contract (e.g. a public SDK method consumed by non-Effect users):

```ts
// eslint-disable-next-line safer-by-default/promise-type -- public SDK surface, callers are not on Effect
export function fetchUserAsPromise(id: string): Promise<User> {
  return Effect.runPromise(fetchUser(id));
}
```
