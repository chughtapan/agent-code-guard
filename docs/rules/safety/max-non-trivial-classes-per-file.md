# `agent-code-guard/max-non-trivial-classes-per-file`

**What it flags:** files defining more than `max` (default `1`) **non-trivial** classes. A class is *trivial* — and therefore exempt — if its body has zero members. That covers Effect's tag-class patterns by construction: `Data.TaggedError`, `Data.TaggedClass`, `Schema.Class`, `Schema.TaggedClass`, `Context.Tag`, `Effect.Service`. Any class that adds methods, fields, or constructor logic counts.

**Why:** ESLint's built-in `max-classes-per-file` was designed for OO codebases where each class carries logic. Effect-flavored TypeScript co-locates many *nominal* classes per file — error groups in `errors.ts`, related context tags in `tags.ts`. Capping all classes at 1 fights the pattern. Capping only classes with real bodies preserves the original signal (one logic-bearing class per file) without breaking the tag-class idiom.

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

## Options

```jsonc
{
  "agent-code-guard/max-non-trivial-classes-per-file": ["error", { "max": 1 }]
}
```

- `max` *(integer ≥ 1, default `1`)* — number of non-trivial classes allowed per file.
