# `agent-code-guard/max-non-trivial-classes-per-file`

**What it flags:** files defining more than `max` (default `1`) **non-trivial** classes. A class is *trivial* — and therefore exempt — if it extends a recognized Effect tag-class factory: `Data.TaggedError`, `Data.TaggedClass`, `Data.Class`, `Data.Error`, `Schema.Class`, `Schema.TaggedClass`, `Schema.TaggedError`, `Schema.TaggedRequest`, `Context.Tag`, `Context.Reference`, `Effect.Service`, `Effect.Tag`. The body doesn't change the exemption — a tag class with `override toString()` or `static layer = ...` is still a tag class.

**Why:** ESLint's built-in `max-classes-per-file` was designed for OO codebases where each class carries logic. Effect-flavored TypeScript co-locates many *nominal* classes per file — error groups in `errors.ts`, related context tags in `tags.ts`. Capping all classes at 1 fights the pattern. Exempting tag-factory subclasses preserves the original signal (one logic-bearing class per file) without breaking the tag-class idiom — even when those tag classes carry methods or static fields.

## Allowed (zero non-trivial classes counted)

```ts
class FooError extends Data.TaggedError("FooError")<{ cause: string }> {}
class BarError extends Data.TaggedError("BarError")<{ cause: string }> {}
class BazError extends Data.TaggedError("BazError")<{ cause: string }> {}
```

```ts
class UserTag extends Context.Tag("User")<UserTag, UserService>() {}
class DbTag extends Context.Tag("Db")<DbTag, DbService>() {}
```

## Allowed (tag classes with bodies — the body doesn't matter)

```ts
class FooError extends Data.TaggedError("FooError")<{ cause: string }> {
  override toString() { return `${this._tag}: ${this.cause}`; }
}
class UserService extends Effect.Service<UserService>()("UserService", {
  succeed: { run: () => null },
}) {}
```

## Allowed (one non-trivial class plus tag boilerplate)

```ts
class FooError extends Data.TaggedError("FooError")<{}> {}

class FooService {
  run() { return 42; }
}
```

## Flagged

```ts
class A { run() { return 1; } }
class B { run() { return 2; } }   // second non-trivial class — split into another file
```

```ts
// Empty bodies are NOT free unless the superclass is a recognized tag factory.
class Marker1 {}
class Marker2 {}   // second non-trivial class

@Injectable() class A {}
@Injectable() class B {}   // decorator carries behavior; the empty body is incidental
```

## Options

```jsonc
{
  "agent-code-guard/max-non-trivial-classes-per-file": ["error", { "max": 1 }]
}
```

- `max` *(integer ≥ 1, default `1`)* — number of non-trivial classes allowed per file.
