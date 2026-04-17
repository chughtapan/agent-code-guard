import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-manual-enum-cast.js";

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

ruleTester.run("no-manual-enum-cast", rule, {
  valid: [
    { code: "const s = x as string;" },
    { code: "type Status = 'active' | 'inactive'; const s: Status = 'active';" },
    { code: "const n = x as number | string;" },
    {
      code: "// eslint-disable-next-line @rule-tester/no-manual-enum-cast -- suppression test\nconst s = x as 'a' | 'b';",
    },
  ],
  invalid: [
    {
      code: "const s = x as 'active' | 'inactive';",
      errors: [{ messageId: "manualEnumCast" }],
    },
    {
      code: "const s = row.status as 'pending' | 'done' | 'failed';",
      errors: [{ messageId: "manualEnumCast" }],
    },
    {
      code: "function f(x: unknown) { return x as 'a' | 'b'; }",
      errors: [{ messageId: "manualEnumCast" }],
    },
    {
      code: "const arr = [v as 'x' | 'y'];",
      errors: [{ messageId: "manualEnumCast" }],
    },
    {
      code: "const s = JSON.parse(v).kind as 'create' | 'update' | 'delete';",
      errors: [{ messageId: "manualEnumCast" }],
    },
  ],
});
