import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./prefer-config-redacted.js";

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

ruleTester.run("prefer-config-redacted", rule, {
  valid: [
    // Non-secret name
    { code: `const port = Config.string("PORT");` },
    { code: `const host = Config.string("DATABASE_HOST");` },
    { code: `const region = Config.string("AWS_REGION");` },
    // Already redacted
    { code: `const apiKey = Config.redacted("API_KEY");` },
    // Non-Config.string call
    { code: `const x = Config.number("api_key");` },
    // Not a string literal — can't determine name
    { code: `const x = Config.string(name);` },
  ],
  invalid: [
    // API key
    {
      code: `const apiKey = Config.string("API_KEY");`,
      errors: [{ messageId: "preferRedacted", data: { name: "API_KEY" } }],
    },
    // secret
    {
      code: `const x = Config.string("client-secret");`,
      errors: [{ messageId: "preferRedacted", data: { name: "client-secret" } }],
    },
    // token
    {
      code: `const t = Config.string("AUTH_TOKEN");`,
      errors: [{ messageId: "preferRedacted", data: { name: "AUTH_TOKEN" } }],
    },
    // password
    {
      code: `const p = Config.string("dbPassword");`,
      errors: [{ messageId: "preferRedacted", data: { name: "dbPassword" } }],
    },
    // private_key
    {
      code: `const pk = Config.string("PRIVATE_KEY");`,
      errors: [{ messageId: "preferRedacted", data: { name: "PRIVATE_KEY" } }],
    },
    // bearer
    {
      code: `const b = Config.string("BEARER_TOKEN");`,
      errors: [{ messageId: "preferRedacted", data: { name: "BEARER_TOKEN" } }],
    },
  ],
});
