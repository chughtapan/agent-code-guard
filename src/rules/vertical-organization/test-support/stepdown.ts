/**
 * @file Provides shared source fixtures and assertions for stepdown ordering rule tests.
 */

import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

/**
 * Creates the shared RuleTester configuration for stepdown-order suites.
 *
 * @returns Configured rule tester.
 */
export function stepdownRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
  });
}
