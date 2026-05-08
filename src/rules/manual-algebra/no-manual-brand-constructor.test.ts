import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./no-manual-brand-constructor.js";

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

ruleTester.run("no-manual-brand-constructor", rule, {
  valid: [
    {
      code: "type UserId = string & { readonly __brand: 'UserId' };",
    },
    {
      code: "const project = (value: string): UserId => value as UserId;",
    },
    {
      code: "const UserId = Brand.nominal<UserId>();",
    },
    {
      code: 'const UserIdSchema = Schema.String.pipe(Schema.brand("UserId"));',
    },
    {
      code: "function asUserId(value: string): UserId { const next = value as UserId; return next; }",
    },
    {
      code: "const asUserId = (value: string): user.UserId => value as user.UserId;",
    },
  ],
  invalid: [
    {
      code: "const asUserId = (value: string): UserId => value as UserId;",
      errors: [
        {
          messageId: "manualBrandConstructor",
          data: { name: "asUserId", target: "UserId" },
        },
      ],
    },
    {
      code: "function asUserId(value: string) { return value as UserId; }",
      errors: [
        {
          messageId: "manualBrandConstructor",
          data: { name: "asUserId", target: "UserId" },
        },
      ],
    },
    {
      code: "const UserId = (value: string): UserId => value as UserId;",
      errors: [
        {
          messageId: "manualBrandConstructor",
          data: { name: "UserId", target: "UserId" },
        },
      ],
    },
    {
      code: "const makeUserId = (value: string): UserId => value as UserId;",
      errors: [
        {
          messageId: "manualBrandConstructor",
          data: { name: "makeUserId", target: "UserId" },
        },
      ],
    },
    {
      code: "const toUserId = function (value: string): UserId { return value as UserId; };",
      errors: [
        {
          messageId: "manualBrandConstructor",
          data: { name: "toUserId", target: "UserId" },
        },
      ],
    },
  ],
});
