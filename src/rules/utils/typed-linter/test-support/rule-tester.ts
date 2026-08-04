/**
 * @file Configures the shared typed RuleTester used by typed-linter tests.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

/**
 * Creates a RuleTester backed by the typed fixture TypeScript project.
 * @returns A RuleTester configured with the repository test project.
 */
export function createTypedRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.test.json",
        tsconfigRootDir: process.cwd(),
      },
    },
  });
}
