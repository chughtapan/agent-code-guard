# `safer-by-default/async-keyword`

**What it flags:** The `async` keyword on any function — declarations, expressions, arrows, class methods, and object method shorthand.

**Why:** In an Effect-first codebase, asynchrony is modeled with `Effect.gen` and Effect handlers. Sprinkling `async`/`await` produces dual-track code where some functions return `Promise<T>` and others return `Effect.Effect<T>`, and the two can't be composed without awkward adapters. The discipline is: all asynchrony flows through Effect.

## Before (flagged)

```ts
async function getUser(id: string): Promise<User> {
  const row = await db.selectFrom("users").where("id", "=", id).executeTakeFirst();
  if (!row) throw new NotFoundError(id);
  return row;
}
```

## After (preferred)

```ts
import { Effect } from "effect";

const getUser = (id: string) =>
  Effect.gen(function* () {
    const row = yield* Db.selectFrom("users")
      .where("id", "=", id)
      .executeTakeFirst();
    if (!row) return yield* Effect.fail(new NotFoundError(id));
    return row;
  });
```

Notes for agents:
- Replace `async function foo(...)` with `const foo = (...) => Effect.gen(function* () { ... })`.
- Replace `await <expr>` with `yield* <effectful expr>`. If the `<expr>` is a raw `Promise`, wrap it in `Effect.tryPromise({ try, catch })` first.
- Replace `throw new E(...)` with `return yield* Effect.fail(new E(...))`.

## Exceptions

Interop with a framework that requires an async handler (e.g. Next.js route handlers, some test utilities):

```ts
// eslint-disable-next-line safer-by-default/async-keyword -- Next.js route handler signature requires async
export async function GET(req: Request) {
  return Effect.runPromise(handleGet(req));
}
```

Always give a reason — adoption of this rule means every suppression is a boundary we explicitly accept.
