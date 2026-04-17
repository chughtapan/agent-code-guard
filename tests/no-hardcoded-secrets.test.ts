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
    { code: "const notSecret = 'sk_live_abcdefghijklmnop';" },
    {
      code: "// eslint-disable-next-line @rule-tester/no-hardcoded-secrets -- suppression test\nconst apiKey = 'sk_live_abc123xyz0987654321';",
    },
  ],
  invalid: [
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
  ],
});
