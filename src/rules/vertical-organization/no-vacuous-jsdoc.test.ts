import { RuleTester } from "@typescript-eslint/rule-tester";
import { Linter } from "eslint";
import { afterAll, describe, expect, it } from "vitest";
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
      code: `/** Executes the read operation. */\n/** Useful exported operation. */\nfunction read(): string { return "id"; }`,
    },
  ],
  invalid: [
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
  ],
});

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
