# `safer-by-default/no-raw-throw-new-error`

**What it flags:** `throw new Error(...)`, `throw new TypeError(...)`, `throw new RangeError(...)` in non-test TypeScript/JavaScript. Test files (`**/*.test.*`, `**/*.spec.*`, `**/test/**`, `**/tests/**`) are exempt, as are functions whose name starts with `absurd` (exhaustiveness helpers).

**Why:** A raw throw hides three facts: which call sites it can happen at, which callers know how to handle it, and what the user actually sees. Those surface at runtime, usually in production, usually with bad error messages. A typed error channel (tagged `Data.TaggedError`, a discriminated-union result, or `Effect.fail`) forces the caller to discriminate; the compiler enforces exhaustiveness.

## Before (flagged)

```ts
function loadToken(raw: string): Token {
  if (!raw.startsWith("tok_")) throw new Error("bad token");
  return raw as Token;
}
```

## After (preferred) — tagged error

```ts
import { Data } from "effect";

class BadToken extends Data.TaggedError("BadToken")<{ raw: string }> {}

function loadToken(raw: string): Effect.Effect<Token, BadToken> {
  return raw.startsWith("tok_")
    ? Effect.succeed(raw as Token)
    : Effect.fail(new BadToken({ raw }));
}
```

## After (preferred) — result type

```ts
type LoadToken = { _tag: "Ok"; value: Token } | { _tag: "BadToken"; raw: string };

function loadToken(raw: string): LoadToken {
  return raw.startsWith("tok_")
    ? { _tag: "Ok", value: raw as Token }
    : { _tag: "BadToken", raw };
}
```

## Allowed: `absurd` helper

```ts
function absurd(x: never): never {
  throw new Error(`unreachable: ${JSON.stringify(x)}`);
}
```

Any function whose name begins with `absurd` is exempt. This is the one place a raw throw is appropriate — the compiler already proved the branch is unreachable.

## Exceptions

Re-throwing a caught error is fine and is not flagged (the rule only targets `throw new <Ctor>(...)`):

```ts
try { work(); } catch (err) { logger.error({ err }); throw err; }
```

If you genuinely need a one-off raw throw (e.g. a boot-time invariant that must crash the process loudly), suppress per-line:

```ts
// eslint-disable-next-line safer-by-default/no-raw-throw-new-error -- boot invariant
throw new Error("FATAL: config missing");
```

Rationale: errors are part of a function's type. Tagged errors or discriminated-union results make failure modes exhaustive at the call site; a raw throw does not. See the companion plugin's [PRINCIPLES.md — "Errors are typed, not thrown"](https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md) for the full treatment.
