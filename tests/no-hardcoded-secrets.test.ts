import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-hardcoded-secrets.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
});

ruleTester.run("no-hardcoded-secrets", rule, {
  valid: [
    { code: "const apiKey = 'test';" },
    { code: "const apiKey = process.env.API_KEY;" },
    { code: "const config = { apiKey: 'placeholder' };" },
    // Short value under a non-secret name — no shape, no length trip.
    { code: "const x = 'short';" },
    // Name looks secret-adjacent but value has spaces so no shape matches.
    { code: "const ghp = 'not a real ghp';" },
    // Long-ish text that happens not to match any canonical shape.
    {
      code: "const message = 'this is a normal sentence that is long enough';",
    },
    {
      code: "// eslint-disable-next-line @rule-tester/no-hardcoded-secrets -- suppression test\nconst apiKey = 'sk_live_abc123xyz0987654321';",
    },
  ],
  invalid: [
    // --- Name-gated cases (prior behavior, preserved) ---
    {
      code: "const apiKey = 'sk_live_abc123xyz0987654321';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    {
      code: "const config = { apiKey: 'sk-proj-abcdefghijklmnopqrstuvwxyz' };",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    {
      code: "const token = 'ghp_abc123def456ghi789jkl012';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    {
      code: "client.apiKey = 'sk_live_abcdef0123456789ghijkl';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    {
      code: "const secret = 'Bearer AAAAAAAAAA1234567890abcdef';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    // --- Value-shape cases: non-matching LHS name, rule still fires ---
    // Stripe
    {
      code: "const a = 'sk_live_abcdefghij1234567890';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    // AWS access key ID
    {
      code: "const a = 'AKIAIOSFODNN7EXAMPLE';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    // AWS secret access key (40-char base64-shaped)
    {
      code: "const a = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    // JWT
    {
      code: "const a = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    // GitHub PAT classic (ghp_ + 36 alphanumerics)
    {
      code: "const a = 'ghp_1234567890abcdefghijklmnopqrstuvwxAB';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    // GitHub PAT fine-grained (github_pat_ + 82 chars of [A-Za-z0-9_])
    {
      code: "const a = 'github_pat_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    // OpenAI (sk- + 48 alphanumerics)
    {
      code: "const a = 'sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    // OpenAI project (sk-proj- + 30+ chars of [A-Za-z0-9_-])
    {
      code: "const a = 'sk-proj-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
    // Anthropic (sk-ant- + 30+ chars of [A-Za-z0-9_-])
    {
      code: "const a = 'sk-ant-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';",
      errors: [{ messageId: "hardcodedSecret" }],
    },
  ],
});
