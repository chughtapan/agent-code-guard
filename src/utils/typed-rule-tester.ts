import { RuleTester } from "@typescript-eslint/rule-tester";
import { createRequire } from "node:module";
import { afterAll, describe, it } from "vitest";

const require = createRequire(import.meta.url);

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

export function createTypedRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.test.json",
        tsconfigRootDir: process.cwd(),
      },
    },
  });
}
