import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/async-keyword.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
});

ruleTester.run("async-keyword", rule, {
  valid: [
    { code: "function foo() { return 1; }" },
    { code: "const bar = () => 1;" },
    { code: "class C { m() { return 1; } }" },
    {
      code: "// eslint-disable-next-line @rule-tester/async-keyword -- suppression test (real prefix in production is `safer-by-default/async-keyword`)\nasync function suppressed() {}",
    },
  ],
  invalid: [
    {
      code: "async function foo() {}",
      errors: [{ messageId: "asyncKeyword" }],
    },
    {
      code: "const foo = async () => 1;",
      errors: [{ messageId: "asyncKeyword" }],
    },
    {
      code: "const foo = async function () { return 1; };",
      errors: [{ messageId: "asyncKeyword" }],
    },
    {
      code: "class C { async m() { return 1; } }",
      errors: [{ messageId: "asyncKeyword" }],
    },
    {
      code: "const obj = { async m() { return 1; } };",
      errors: [{ messageId: "asyncKeyword" }],
    },
  ],
});
