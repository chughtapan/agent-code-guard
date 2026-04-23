import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/manual-brand.js";

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

ruleTester.run("manual-brand", rule, {
  valid: [
    {
      code: 'const UserIdSchema = Schema.String.pipe(Schema.brand("UserId"));',
    },
    {
      code: "type UserPayload = { readonly brand: string; readonly id: string };",
    },
    {
      code: "interface UserProps { readonly brand: string; readonly label: string; }",
    },
    {
      code: 'const UserId = Brand.nominal<UserId>();',
    },
    {
      code: "// eslint-disable-next-line @rule-tester/manual-brand -- suppression test\ntype UserId = string & { readonly __brand: 'UserId' };",
    },
  ],
  invalid: [
    {
      code: 'type UserId = string & { readonly __brand: "UserId" };',
      errors: [{ messageId: "manualBrand", data: { name: "UserId" } }],
    },
    {
      code: 'type RuntimeRequestId = string & { readonly _brand: "RuntimeRequestId" };',
      errors: [{ messageId: "manualBrand", data: { name: "RuntimeRequestId" } }],
    },
    {
      code: 'type AgentName = string & { readonly brand: "AgentName" };',
      errors: [{ messageId: "manualBrand", data: { name: "AgentName" } }],
    },
    {
      code: 'const asUserId = (value: string): UserId => value as UserId;',
      errors: [{ messageId: "manualBrand", data: { name: "asUserId" } }],
    },
  ],
});
