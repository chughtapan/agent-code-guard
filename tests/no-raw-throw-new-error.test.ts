import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-raw-throw-new-error.js";

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

ruleTester.run("no-raw-throw-new-error", rule, {
  valid: [
    {
      filename: "/repo/src/auth.ts",
      code: "throw new TokenExpired({ at: now });",
    },
    {
      filename: "/repo/src/util.ts",
      code: "function absurd(x: never): never { throw new Error(`unreachable: ${x}`); }",
    },
    {
      filename: "/repo/src/util.ts",
      code: "const absurdGuard = (x: never): never => { throw new Error(String(x)); };",
    },
    {
      filename: "/repo/src/util.ts",
      code: "class Exhaustive { absurd(x: never): never { throw new Error(String(x)); } }",
    },
    {
      filename: "/repo/src/__tests__/auth.ts",
      code: "throw new Error('fixture setup failed');",
    },
    {
      filename: "/repo/e2e/auth.ts",
      code: "throw new Error('e2e setup failed');",
    },
    {
      filename: "/repo/src/auth.test.ts",
      code: "it('fails', () => { throw new Error('nope'); });",
    },
    {
      filename: "/repo/src/auth.spec.ts",
      code: "throw new Error('nope');",
    },
    {
      filename: "/repo/tests/helpers.ts",
      code: "throw new Error('fixture setup failed');",
    },
    {
      filename: "/repo/src/rethrow.ts",
      code: "try { go(); } catch (err) { throw err; }",
    },
    {
      filename: "/repo/src/auth.ts",
      code: "// eslint-disable-next-line @rule-tester/no-raw-throw-new-error -- suppression test\nthrow new Error('boom');",
    },
  ],
  invalid: [
    {
      filename: "/repo/src/auth.ts",
      code: "throw new Error('boom');",
      errors: [{ messageId: "rawThrow", data: { ctor: "Error" } }],
    },
    {
      filename: "/repo/src/auth.ts",
      code: "throw new TypeError('bad arg');",
      errors: [{ messageId: "rawThrow", data: { ctor: "TypeError" } }],
    },
    {
      filename: "/repo/src/auth.ts",
      code: "throw new RangeError('out of range');",
      errors: [{ messageId: "rawThrow", data: { ctor: "RangeError" } }],
    },
    {
      filename: "/repo/src/auth.ts",
      code: "function signIn() { if (x) throw new Error('bad'); }",
      errors: [{ messageId: "rawThrow", data: { ctor: "Error" } }],
    },
    {
      filename: "/repo/src/util.ts",
      code: "function notAbsurd(x: never) { throw new Error('unreachable'); }",
      errors: [{ messageId: "rawThrow", data: { ctor: "Error" } }],
    },
    {
      filename: "/repo/src/auth.ts",
      code: "const fail = () => { throw new Error('x'); };",
      errors: [{ messageId: "rawThrow", data: { ctor: "Error" } }],
    },
  ],
});
