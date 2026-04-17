import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/then-chain.js";

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

ruleTester.run("then-chain", rule, {
  valid: [
    { code: "const x = obj.other();" },
    { code: "const x = obj.map(f);" },
    { code: "const then = 1; const x = then;" },
    {
      code: "// eslint-disable-next-line @rule-tester/then-chain -- suppression test (real prefix in production is `safer-by-default/then-chain`)\nPromise.resolve(1).then((v) => v);",
    },
  ],
  invalid: [
    {
      code: "Promise.resolve(1).then((v) => v);",
      errors: [{ messageId: "thenChain" }],
    },
    {
      code: "fetch('/x').then((r) => r.json());",
      errors: [{ messageId: "thenChain" }],
    },
    {
      code: "foo.then(ok, err);",
      errors: [{ messageId: "thenChain" }],
    },
    {
      code: "await foo.then((v) => v);",
      errors: [{ messageId: "thenChain" }],
    },
    {
      code: "a.b.c.then(x => x);",
      errors: [{ messageId: "thenChain" }],
    },
  ],
});
