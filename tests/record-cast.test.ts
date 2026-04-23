import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/record-cast.js";

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

ruleTester.run("record-cast", rule, {
  valid: [
    { code: "const r = {} as Record<string, number>;" },
    { code: "const r = {} as { [k: string]: unknown };" },
    { code: "type R = Record<string, unknown>; const r: R = {};" },
    { code: "const r = {} as Dictionary<string, unknown>;" },
    { code: "const r = {} as Lib.Record<string, unknown>;" },
    { code: "const r = {} as Record<string>;" },
    { code: "const r = {} as Record<number, unknown>;" },
    { code: "const r = {} as Record<string, any>;" },
    {
      code: "// eslint-disable-next-line @rule-tester/record-cast -- suppression test (real prefix in production is `agent-code-guard/record-cast`)\nconst r = {} as Record<string, unknown>;",
    },
  ],
  invalid: [
    {
      code: "const r = {} as Record<string, unknown>;",
      errors: [{ messageId: "recordCast" }],
    },
    {
      code: "const r = x as Record<string, unknown>;",
      errors: [{ messageId: "recordCast" }],
    },
    {
      code: "function f(x: unknown) { return x as Record<string, unknown>; }",
      errors: [{ messageId: "recordCast" }],
    },
    {
      code: "const arr = [x as Record<string, unknown>];",
      errors: [{ messageId: "recordCast" }],
    },
    {
      code: "const r = JSON.parse(s) as Record<string, unknown>;",
      errors: [{ messageId: "recordCast" }],
    },
  ],
});
