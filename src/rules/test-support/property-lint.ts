/**
 * @file Lints one source string against a single rule with a parser-only
 * config, for property tests that assert diagnostic counts rather than exact
 * ranges.
 */

import * as tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { plugin } from "../../index.js";

const parser: Linter.Parser = tsParser;
const pluginEntry: NonNullable<Linter.Config["plugins"]>[string] = plugin;
const linter = new Linter();

/**
 * Runs one rule over a source string.
 *
 * The config is deliberately parser-only: these properties assert how many
 * diagnostics a rule emits, so the type-aware service would cost time without
 * changing the answer.
 * @param code The source text to lint.
 * @param ruleId The fully qualified rule identifier.
 * @param filename The project-relative fixture filename.
 * @returns The emitted lint diagnostics.
 */
export function lintRule(
  code: string,
  ruleId: string,
  filename = "src/test.ts",
): Linter.LintMessage[] {
  return linter.verify(code, configFor(ruleId), { filename });
}

function configFor(ruleId: string): Linter.Config {
  return {
    files: ["**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "agent-code-guard": pluginEntry },
    rules: { [ruleId]: "error" },
  };
}
