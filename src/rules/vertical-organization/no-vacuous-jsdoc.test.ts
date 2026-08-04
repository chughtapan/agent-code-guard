/**
 * @file Enforces substantive JSDoc by testing boilerplate, missing meaning, and source-preserving verification under the fixer API.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { Linter } from "eslint";
import { afterAll, describe, expect, it, vi } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import { noVacuousJsdoc as rule } from "./no-vacuous-jsdoc.js";

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

ruleTester.run("no-vacuous-jsdoc", rule, {
  valid: [
    {
      code: `/** Short, specific prose is valid. */\nconst item = 1;`,
    },
    {
      name: "ignores an empty JSDoc token when comment-parser emits no block",
      code: `/**/\nexport {};`,
    },
    {
      code: `/**\n * @file The module's contract is documented.\n */\nexport {};`,
    },
    {
      code: `/**\n * Executes the unrelated operation.\n */\nconst run = () => undefined;`,
    },
    {
      code: `/**\n * @returns {string} A durable identifier.\n * @throws {Error} The backing service is unavailable.\n */\nfunction read(): string { return "id"; }`,
    },
    {
      code: `/**\n * The run result.\n */\nconst unrelated = 1;`,
    },
    {
      name: "non-callable declarations and enums are outside the closed template candidate sets",
      code: `/** The Account result. */\nclass Account {}\n/** Executes the count operation. */\nconst count = 1;\n/** Represents Status values. */\nenum Status { Ready }`,
    },
    { code: `/**\n * @deprecated TBD\n */\nconst notSupportedTag = 1;` },
    {
      code: `/**\n * @param input Executes the input operation.\n */\nfunction run(input: string): string { return input; }`,
    },
    {
      name: "named tags do not use the attached callable as a candidate",
      code: `/** @param input Executes the read operation. */\nfunction read(input: string): string { return input; }`,
    },
    {
      name: "callable-derived templates stay valid when the symbol does not match",
      code: `/** The read result. */\nfunction write(): string { return "id"; }\n/** Executes the read operation. */\nfunction remove(): string { return "id"; }`,
    },
    {
      name: "enums are outside the closed attachment candidate grammar",
      code: `/** Provides the Phase runtime value. */\nenum Phase { Start }`,
    },
    {
      code: `/** Executes the read operation. */\n/** Useful exported operation. */\nfunction read(): string { return "id"; }`,
    },
  ],
  invalid: [
    {
      name: "rejects a result template derived from a callable symbol",
      code: `/** The read result. */\nfunction read(): string { return "id"; }`,
      output: null,
      errors: [{ messageId: "vacuousBlockDescription" }],
    },
    {
      name: "rejects an operation template derived from a callable symbol",
      code: `/** Executes the read operation. */\nfunction read(): string { return "id"; }`,
      output: null,
      errors: [{ messageId: "vacuousBlockDescription" }],
    },
    {
      code: `/** TODO */\nconst item = 1;`,
      output: null,
      errors: [{ messageId: "vacuousBlockDescription", line: 1, column: 5 }],
    },
    {
      code: `/**\n * tBd.\n */\nconst item = 1;`,
      output: null,
      errors: [{ messageId: "vacuousBlockDescription", line: 2, column: 4 }],
    },
    {
      code: `/**\n * @param input TODO\n * @arg input TBD\n * @argument input FIXME\n * @returns XXX\n * @return N/A\n * @property value none\n * @prop value unknown\n * @throws {Error} no description\n * @exception {Error} TODO\n */\nfunction read(input: string): string { return input; }`,
      output: null,
      errors: [
        { messageId: "vacuousTagDescription" },
        { messageId: "vacuousTagDescription" },
        { messageId: "vacuousTagDescription" },
        { messageId: "vacuousTagDescription" },
        { messageId: "vacuousTagDescription" },
        { messageId: "vacuousTagDescription" },
        { messageId: "vacuousTagDescription" },
        { messageId: "vacuousTagDescription" },
        { messageId: "vacuousTagDescription" },
      ],
    },
    {
      code: `/** Value supplied to the operation. */\nconst first = 1;\n/** Name of the operation. */\nconst second = 2;\n/** Re-exports the public API from current module. */\nconst third = 3;\n/** Protocol definition to process. */\nconst fourth = 4;`,
      output: null,
      errors: [
        { messageId: "vacuousBlockDescription" },
        { messageId: "vacuousBlockDescription" },
        { messageId: "vacuousBlockDescription" },
        { messageId: "vacuousBlockDescription" },
      ],
    },
    {
      code: `/** The read() result. */\nfunction read(): string { return "id"; }\n/** Provides the write runtime value. */\nfunction write(): string { return "id"; }\n/** Executes the remove operation. */\nfunction remove(): string { return "id"; }`,
      output: null,
      errors: [
        { messageId: "vacuousBlockDescription" },
        { messageId: "vacuousBlockDescription" },
        { messageId: "vacuousBlockDescription" },
      ],
    },
    {
      code: `/**\n * Represents Account values.\n */\nclass Account {}`,
      output: null,
      errors: [{ messageId: "vacuousBlockDescription" }],
    },
    {
      code: `/**\n * Represents Account values.\n */\ntype Account = string;\n/**\n * Represents AccountShape values.\n */\ninterface AccountShape {}\n/**\n * Represents account values.\n */\nconst account = 1;`,
      output: null,
      errors: [
        { messageId: "vacuousBlockDescription" },
        { messageId: "vacuousBlockDescription" },
        { messageId: "vacuousBlockDescription" },
      ],
    },
    {
      code: `/**\n * @param input The input result.\n * @property output Provides the output runtime value.\n */\nfunction read(input: string): string { return input; }`,
      output: null,
      errors: [{ messageId: "vacuousTagDescription" }, { messageId: "vacuousTagDescription" }],
    },
    {
      name: "normalizes every placeholder spelling without widening its closed vocabulary",
      code: `/**\n *  TODO\t\n */\nconst todo = 1;\n/**\n * FixMe.\n */\nconst fixme = 2;\n/**\n * N/A\n */\nconst na = 3;`,
      output: null,
      errors: [
        { messageId: "vacuousBlockDescription", line: 2, column: 5, endLine: 2, endColumn: 9 },
        { messageId: "vacuousBlockDescription", line: 6, column: 4, endLine: 6, endColumn: 10 },
        { messageId: "vacuousBlockDescription", line: 10, column: 4, endLine: 10, endColumn: 7 },
      ],
    },
    {
      name: "collapses interior whitespace before matching a fixed template",
      code: `/** Value   supplied\tto the operation. */\nconst item = 1;`,
      output: null,
      errors: [{ messageId: "vacuousBlockDescription", line: 1, column: 5, endLine: 1, endColumn: 39 }],
    },
    {
      name: "recognizes every dynamic callable template only for its attached callable",
      code: `/** The read() result. */\nfunction read(): string { return "id"; }\n/** Provides the write() runtime value. */\nfunction write(): string { return "id"; }\n/** Executes the remove() operation. */\nfunction remove(): string { return "id"; }\n/** The start() result. */\nconst start = (): undefined => undefined;`,
      output: null,
      errors: [
        { messageId: "vacuousBlockDescription", line: 1, column: 5, endLine: 1, endColumn: 23 },
        { messageId: "vacuousBlockDescription", line: 3, column: 5, endLine: 3, endColumn: 40 },
        { messageId: "vacuousBlockDescription", line: 5, column: 5, endLine: 5, endColumn: 37 },
        { messageId: "vacuousBlockDescription", line: 7, column: 5, endLine: 7, endColumn: 24 },
      ],
    },
    {
      name: "uses the named tag candidate instead of an attachment candidate",
      code: `/**\n * @param input The input result.\n * @arg token Provides the token runtime value.\n * @argument source The source result.\n * @property output Provides the output runtime value.\n * @prop item The item result.\n */\nfunction read(input: string, token: string, source: string): string { return input + token + source; }`,
      output: null,
      errors: [
        { messageId: "vacuousTagDescription", line: 2, column: 17, endLine: 2, endColumn: 34 },
        { messageId: "vacuousTagDescription", line: 3, column: 15, endLine: 3, endColumn: 48 },
        { messageId: "vacuousTagDescription", line: 4, column: 21, endLine: 4, endColumn: 39 },
        { messageId: "vacuousTagDescription", line: 5, column: 21, endLine: 5, endColumn: 55 },
        { messageId: "vacuousTagDescription", line: 6, column: 15, endLine: 6, endColumn: 31 },
      ],
    },
  ],
});

it("publishes the immutable, non-fixing problem-rule contract", () => {
  expect(rule.meta).toMatchObject({
    type: "problem",
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
    messages: {
      vacuousBlockDescription: "JSDoc block description is a known vacuous placeholder or filler template.",
      vacuousTagDescription: "JSDoc tag description is a known vacuous placeholder or filler template.",
    },
  });
});

it("evaluates the module contract and every closed grammar member after a fresh module load", async () => {
  vi.resetModules();
  const { noVacuousJsdoc: freshRule } = await import("./no-vacuous-jsdoc.js");
  const linter = new Linter();
  const verify = (code: string) => linter.verify(
    code,
    {
      files: ["**/*.ts"],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
      plugins: { guard: { rules: { fresh: freshRule } } },
      rules: { "guard/fresh": "error" },
    },
    { filename: "fresh.ts" },
  );
  for (const [tag, body] of [
    ["param", "value TODO"], ["arg", "value TODO"], ["argument", "value TODO"], ["property", "value TODO"], ["prop", "value TODO"],
    ["returns", "TODO"], ["return", "TODO"], ["throws", "{Error} TODO"], ["exception", "{Error} TODO"],
  ]) {
    expect(verify(`/** @${tag} ${body} */\nfunction read(value: string): string { return value; }`)).toHaveLength(1);
  }
  for (const placeholder of ["TODO", "TBD", "FIXME", "XXX", "N/A", "none", "unknown", "no description"]) {
    expect(verify(`/** ${placeholder} */\nconst value = 1;`)).toHaveLength(1);
  }
  for (const template of [
    "Value supplied to the operation.",
    "Name of the operation.",
    "Re-exports the public API from current module.",
    "Protocol definition to process.",
  ]) {
    expect(verify(`/** ${template} */\nconst value = 1;`)).toHaveLength(1);
  }
  expectCallableTemplateSemantics(verify);
  expect(freshRule.meta).toMatchObject({
    type: "problem",
    docs: { description: "Rejects known placeholder and mechanically-derived JSDoc filler without judging other prose." },
    messages: {
      vacuousBlockDescription: "JSDoc block description is a known vacuous placeholder or filler template.",
      vacuousTagDescription: "JSDoc tag description is a known vacuous placeholder or filler template.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  });
  expect(freshRule.name).toBe("no-vacuous-jsdoc");
  expect(freshRule.meta.docs.description).toBe("Rejects known placeholder and mechanically-derived JSDoc filler without judging other prose.");
  // eslint-disable-next-line sonarjs/deprecation, @typescript-eslint/no-deprecated -- The mutation contract includes the rule creator's runtime default-options field.
  expect(freshRule.defaultOptions).toEqual([]);
  expect(freshRule.meta.docs.url).toBeTypeOf("string");
});

function expectCallableTemplateSemantics(verify: (code: string) => readonly unknown[]): void {
  expect(verify(`/** The read result. */\nfunction read(): string { return "id"; }`)).toHaveLength(1);
  expect(verify(`/** Executes the read operation. */\nfunction read(): string { return "id"; }`)).toHaveLength(1);
  expect(verify(`/** @param input Executes the read operation. */\nfunction read(input: string): string { return input; }`)).toHaveLength(0);
  expect(verify(`/** Provides the Phase runtime value. */\nenum Phase { Start }`)).toHaveLength(0);
}

it("leaves source unchanged through verifyAndFix", () => {
  const code = `/** TODO */\nconst item = 1;`;
  const linter = new Linter();
  const result = linter.verifyAndFix(
    code,
    {
      files: ["**/*.ts"],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
      plugins: { guard: { rules: { "no-vacuous-jsdoc": rule } } },
      rules: { "guard/no-vacuous-jsdoc": "error" },
    },
    { filename: "source.ts" },
  );
  expect(result.fixed).toBe(false);
  expect(result.output).toBe(code);
});
