import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/as-unknown-as.js";

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

ruleTester.run("as-unknown-as", rule, {
  valid: [
    {
      code: "const value = raw as unknown;",
    },
    {
      code: "const value = raw as Foo;",
    },
    {
      code: "const value = raw as any as Foo;",
    },
    {
      code: "const value = <Foo>raw;",
    },
    {
      code: "// eslint-disable-next-line @rule-tester/as-unknown-as -- suppression test\nconst value = raw as unknown as Foo;",
    },
  ],
  invalid: [
    {
      code: "const value = raw as unknown as Foo;",
      errors: [{ messageId: "asUnknownAs" }],
    },
    {
      code: "const value = (raw as unknown) as Foo;",
      errors: [{ messageId: "asUnknownAs" }],
    },
    {
      code: "const value = <Foo>(<unknown>raw);",
      errors: [{ messageId: "asUnknownAs" }],
    },
  ],
});
