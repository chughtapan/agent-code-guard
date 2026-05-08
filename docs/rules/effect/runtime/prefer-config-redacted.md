# `agent-code-guard/prefer-config-redacted`

**What it flags:** A call to `Config.string("<name>")` where `<name>` matches the secret regex (case-insensitive): `api_key` / `apiKey`, `secret`, `token`, `password`, `credential`, `private_key`, `auth`, `bearer`, `access_key`, etc. The literal name string is the signal — `Config.string(varName)` is not flagged because the rule can't see what `varName` resolves to.

**Why:** `Config.string` reads a value into a plain `string`. Plain strings show up in:

- Default `Effect.log("...", config)` output
- Default `JSON.stringify` output
- Stack traces and error messages
- The Effect runtime's debug printer

`Config.redacted` returns a `Redacted<string>` whose `toString()` and `JSON.stringify` render as `<redacted>`. The actual secret is only available via `Redacted.value(...)` at the call site that needs it. That removes whole classes of leak: a stray `console.log(config)` no longer prints the API key.

## Before (flagged)

```ts
import { Config } from "effect";

const apiKey = Config.string("API_KEY"); // flagged
const dbPassword = Config.string("DB_PASSWORD"); // flagged
```

## After (preferred)

```ts
import { Config, Redacted } from "effect";

const apiKey = Config.redacted("API_KEY");

// At the use site:
const program = Effect.gen(function* () {
  const key = yield* apiKey;
  yield* fetch("https://api.example.com", {
    headers: { Authorization: `Bearer ${Redacted.value(key)}` },
  });
});
```

## What's matched

The regex is intentionally inclusive (false positives are easier to suppress than missed leaks):

- `api_key`, `apiKey`, `API-KEY`
- `secret`, `client_secret`, `clientSecret`
- `token`, `auth_token`, `bearer_token`
- `password`, `passwd`
- `credential`
- `private_key`, `PRIVATE_KEY`
- `auth`
- `bearer`
- `access_key`

If your team uses different conventions, scope the rule (or suppress per-line) — the rule is opinionated about names, not about your config layout.

## What's not matched

- `Config.number(...)` — only `Config.string` is in scope (numbers are rarely secret).
- Variable references — `Config.string(NAME_FROM_VAR)` is skipped because we can't see the literal.
- Already-redacted calls (`Config.redacted("X")`) are obviously fine.

## Pairing

- `no-process-env-at-runtime` — push config reads to the boundary in the first place.
- `no-env-nonnull-assert` — keep the boundary read validated, not asserted.

## Exceptions

```ts
// eslint-disable-next-line agent-code-guard/prefer-config-redacted -- this token is a public webhook URL fragment, not a secret
const webhookToken = Config.string("PUBLIC_WEBHOOK_TOKEN");
```
