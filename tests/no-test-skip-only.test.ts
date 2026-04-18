import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-test-skip-only.js";

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

ruleTester.run("no-test-skip-only", rule, {
  valid: [
    {
      filename: "/repo/src/auth.test.ts",
      code: "it('passes', () => { expect(1).toBe(1); });",
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "describe('suite', () => { test('a', () => {}); });",
    },
    {
      filename: "/repo/src/auth.ts",
      code: "it.skip('nope', () => {});",
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "test.skip('wip', () => {});",
      options: [{ allow: ["skip"] }],
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "it.only('focus', () => {});",
      options: [{ allow: ["only"] }],
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "xit('allowed', () => {});",
      options: [{ allow: ["skip"] }],
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "// eslint-disable-next-line @rule-tester/no-test-skip-only -- suppression test\nit.skip('nope', () => {});",
    },
  ],
  invalid: [
    {
      filename: "/repo/src/auth.test.ts",
      code: "it.skip('wip', () => {});",
      errors: [{ messageId: "skipOrOnly", data: { modifier: "skip" } }],
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "it.only('focus', () => {});",
      errors: [{ messageId: "skipOrOnly", data: { modifier: "only" } }],
    },
    {
      filename: "/repo/src/auth.spec.ts",
      code: "describe.skip('later', () => {});",
      errors: [{ messageId: "skipOrOnly", data: { modifier: "skip" } }],
    },
    {
      filename: "/repo/tests/auth.ts",
      code: "describe.only('here', () => {});",
      errors: [{ messageId: "skipOrOnly", data: { modifier: "only" } }],
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "test.skip('wip', () => {}); test.only('focus', () => {});",
      errors: [
        { messageId: "skipOrOnly", data: { modifier: "skip" } },
        { messageId: "skipOrOnly", data: { modifier: "only" } },
      ],
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "xit('disabled', () => {});",
      errors: [{ messageId: "skipOrOnly", data: { modifier: "skip" } }],
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "xdescribe('disabled', () => {});",
      errors: [{ messageId: "skipOrOnly", data: { modifier: "skip" } }],
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "it.only('focus', () => {});",
      options: [{ allow: ["skip"] }],
      errors: [{ messageId: "skipOrOnly", data: { modifier: "only" } }],
    },
  ],
});
