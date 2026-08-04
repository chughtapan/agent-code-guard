/**
 * @file Tests the testing/no-vitest-mocks ESLint rule with representative valid and invalid lint fixtures.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { noVitestMocks as rule } from "./no-vitest-mocks.js";
import * as tsParser from "@typescript-eslint/parser";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
});

ruleTester.run("no-vitest-mocks", rule, {
  valid: [
    { code: "it('works', () => {});" },
    { code: "describe('x', () => {});" },
    { code: "mock('./x');" },
    { code: "helpers.mock('./x');" },
    { code: "vi['mock']('./x');" },
    { code: "vi.fn();" },
    {
      code: "class Suite { #mock(path) { return path; } run(vi) { return vi.#mock('./x'); } }",
    },
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
