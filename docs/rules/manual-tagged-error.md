# `safer-by-default/manual-tagged-error`

**What it flags:** error-shaped classes, interfaces, and type aliases that manually declare `_tag`, plus returned or error-payload object literals that hand-build tagged error values.

**Why:** hand-rolled tagged errors drift. They skip the standard Effect error helpers, encourage manual `_tag` branching, and make the error surface inconsistent across the codebase. `Data.TaggedError(...)` gives you the tag, the constructor, and the expected error semantics in one place.

## Before (flagged)

```ts
export class RunError extends Error {
  readonly _tag = "RunError" as const;
}

export type ConfigLoadError =
  | { readonly _tag: "ConfigMissing"; readonly path: string }
  | { readonly _tag: "ConfigInvalid"; readonly path: string };
```

## After (preferred)

```ts
export class RunError extends Data.TaggedError("RunError")<{
  readonly cause?: unknown;
}> {}

export class ConfigMissingError extends Data.TaggedError("ConfigMissingError")<{
  readonly path: string;
}> {}

export class ConfigInvalidError extends Data.TaggedError("ConfigInvalidError")<{
  readonly path: string;
}> {}
```

## Before (also flagged)

```ts
return new PlannedHarnessIngressError({
  cause: {
    _tag: "ParseFailure",
    path,
    message,
  },
});
```

## After (preferred)

```ts
return new PlannedHarnessIngressError({
  cause: ParseFailure({ path, message }),
});
```

This rule stays focused on error construction. `_tag`-based domain models that are not being returned as errors or embedded into error payloads are still out of scope.
