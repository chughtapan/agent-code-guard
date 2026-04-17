import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/promise-type.js";

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

ruleTester.run("promise-type", rule, {
  valid: [
    { code: "function foo(): number { return 1; }" },
    { code: "const m: Map<string, Promise<number>> = new Map();" },
    { code: "type X = Promise<number>;" },
    {
      code: "// eslint-disable-next-line @rule-tester/promise-type -- suppression test (real prefix in production is `safer-by-default/promise-type`)\nfunction suppressed(): Promise<number> { return Promise.resolve(1); }",
    },
  ],
  invalid: [
    {
      code: "function foo(): Promise<number> { return Promise.resolve(1); }",
      errors: [{ messageId: "promiseReturn" }],
    },
    {
      code: "const foo = (): Promise<void> => Promise.resolve();",
      errors: [{ messageId: "promiseReturn" }],
    },
    {
      code: "class C { m(): Promise<number> { return Promise.resolve(1); } }",
      errors: [{ messageId: "promiseReturn" }],
    },
    {
      code: "const foo = function (): Promise<number> { return Promise.resolve(1); };",
      errors: [{ messageId: "promiseReturn" }],
    },
    {
      code: "declare function foo(): Promise<number>;",
      errors: [{ messageId: "promiseReturn" }],
    },
    {
      code: "interface I { m(): Promise<number>; }",
      errors: [{ messageId: "promiseReturn" }],
    },
  ],
});
