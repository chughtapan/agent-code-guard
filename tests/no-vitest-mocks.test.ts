import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-vitest-mocks.js";

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

ruleTester.run("no-vitest-mocks", rule, {
  valid: [
    { code: "it('works', () => {});" },
    { code: "describe('x', () => {});" },
    { code: "mock('./x');" },
    {
      code: "// eslint-disable-next-line @rule-tester/no-vitest-mocks -- suppression test\nvi.mock('./x');",
    },
  ],
  invalid: [
    {
      code: "vi.mock('./x');",
      errors: [{ messageId: "vitestMock", data: { method: "mock" } }],
    },
    {
      code: "vi.hoisted(() => ({ x: 1 }));",
      errors: [{ messageId: "vitestMock", data: { method: "hoisted" } }],
    },
    {
      code: "vi.spyOn(obj, 'm');",
      errors: [{ messageId: "vitestMock", data: { method: "spyOn" } }],
    },
    {
      code: "beforeAll(() => { vi.mock('./y'); });",
      errors: [{ messageId: "vitestMock" }],
    },
    {
      code: "vi.mock('./a'); vi.spyOn(b, 'c');",
      errors: [{ messageId: "vitestMock" }, { messageId: "vitestMock" }],
    },
  ],
});
