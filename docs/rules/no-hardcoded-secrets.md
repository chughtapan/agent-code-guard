# `agent-code-guard/no-hardcoded-secrets`

**What it flags:** String literals that look like hardcoded secrets, caught by either of two triggers:

1. **Name-gated:** 20+ character strings assigned to identifiers matching `apiKey` / `api_key` / `secret` / `token` / `password` / `authToken` (case-insensitive). Known placeholders (`test`, `dummy`, `placeholder`, `your-key-here`, `example`, `sample`, `mock`, `xxx…`) are allowed.
2. **Value-shape:** strings matching a canonical secret shape, regardless of the LHS identifier. Renaming `const apiKey = 'sk_live_…'` to `const a = 'sk_live_…'` no longer bypasses the rule.

**Why:** A hardcoded production secret in source is an incident waiting to happen — it gets pushed to git, crawled by a scraper, leaked to a log, or shared in a bug report. Even in test files, hardcoded keys are usually real keys someone "just used to get the test passing." Read secrets from the environment at runtime and fail loudly when they're missing.

## Canonical shapes detected

| Provider | Shape |
| --- | --- |
| Stripe | `/^(sk\|pk\|rk)_(live\|test)_[A-Za-z0-9]{16,}$/` |
| AWS access key ID | `/^AKIA[0-9A-Z]{16}$/` |
| AWS secret access key | `/^[A-Za-z0-9/+=]{40}$/` (note: collides with generic base64 — see options) |
| JWT | `/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/` |
| GitHub PAT (classic) | `/^ghp_[A-Za-z0-9]{36}$/` |
| GitHub PAT (fine-grained) | `/^github_pat_[A-Za-z0-9_]{82}$/` |
| OpenAI API key | `/^sk-[A-Za-z0-9]{48}$/` |
| OpenAI project key | `/^sk-proj-[A-Za-z0-9_-]{30,}$/` |
| Anthropic API key | `/^sk-ant-[A-Za-z0-9_-]{30,}$/` |

## Before (flagged)

```ts
// Name-gated trigger
const apiKey = "sk_live_abc123xyz0987654321";

// Value-shape trigger — rename bypass no longer works
const a = "sk_live_abcdefghij1234567890";
const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const gh = "ghp_1234567890abcdefghijklmnopqrstuvwxAB";

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

## Options

```jsonc
{
  "agent-code-guard/no-hardcoded-secrets": [
    "error",
    { "detectEntropy": false }
  ]
}
```

- `detectEntropy` *(boolean, default `false`)* — opt-in high-entropy base64/hex detection for strings that do not match any canonical shape. **Not yet implemented** — the option is reserved so callers can turn it on once the detector lands. Entropy detection is noisy against hashes, checksums, and fixtures, so it will stay opt-in.

## Exceptions

A public identifier that isn't actually a secret but happens to look like one (e.g. a published API's public key, a well-known test token):

```ts
// eslint-disable-next-line agent-code-guard/no-hardcoded-secrets -- Stripe test mode publishable key, safe to commit
const stripePublishableKey = "pk_test_TYooMQauvdEDq54NiTphI7jx";
```

Public keys and publishable/client-side keys are sometimes exempt — verify with your security posture before suppressing.
