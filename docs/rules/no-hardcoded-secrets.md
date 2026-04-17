# `safer-by-default/no-hardcoded-secrets`

**What it flags:** String literals of 20+ characters assigned to names matching `apiKey` / `api_key` / `secret` / `token` / `password` / `authToken` (case-insensitive). Known placeholder values (`test`, `dummy`, `placeholder`, `your-key-here`, `example`, `sample`, `mock`) are allowed.

**Why:** A hardcoded production secret in source is an incident waiting to happen — it gets pushed to git, crawled by a scraper, leaked to a log, or shared in a bug report. Even in test files, hardcoded keys are usually real keys someone "just used to get the test passing." Read secrets from the environment at runtime and fail loudly when they're missing.

## Before (flagged)

```ts
const apiKey = "sk_live_abc123xyz0987654321";

const client = new Service({
  apiKey: "sk_live_abcdef0123456789ghijkl",
  token: "ghp_abc123def456ghi789jkl012",
});
```

## After (preferred)

```ts
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error("API_KEY env var is required");

const client = new Service({
  apiKey: process.env.SERVICE_API_KEY ?? fail("SERVICE_API_KEY required"),
  token: process.env.GITHUB_TOKEN ?? fail("GITHUB_TOKEN required"),
});
```

Even better — validate all env vars in one place at boot:

```ts
import { Schema } from "effect";

const Env = Schema.Struct({
  API_KEY: Schema.String,
  SERVICE_API_KEY: Schema.String,
  GITHUB_TOKEN: Schema.String,
});

export const env = Schema.decodeUnknownSync(Env)(process.env);
```

Notes for agents:
- If you need a value for a test, use a short obvious placeholder: `"test"`, `"dummy"`, `"placeholder"`, `"your-key-here"`. These are allowed by the rule.
- For integration tests that need a real key, load it from the environment (same as production).

## Exceptions

A public identifier that isn't actually a secret but happens to look like one (e.g. a published API's public key, a well-known test token):

```ts
// eslint-disable-next-line safer-by-default/no-hardcoded-secrets -- Stripe test mode publishable key, safe to commit
const stripePublishableKey = "pk_test_TYooMQauvdEDq54NiTphI7jx";
```

Public keys and publishable/client-side keys are sometimes exempt — verify with your security posture before suppressing.
