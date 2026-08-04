import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";
import { type ParsedJsdocBlock, parseJsdocBlocks } from "./jsdoc-fragments.js";

/* eslint-disable max-lines-per-function, sonarjs/max-lines-per-function -- The closed attachment grammar is intentionally specified as one readable table. */

function parse(code: string): readonly ParsedJsdocBlock[] {
  const linter = new Linter();
  let parsed: readonly ParsedJsdocBlock[] = [];
  linter.verify(
    code,
    {
      files: ["**/*.ts"],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
      plugins: {
        capture: {
          rules: {
            jsdoc: {
              meta: { type: "problem", schema: [], messages: { captured: "captured" } },
              create(context) {
                return {
                  "Program:exit"() {
                    parsed = parseJsdocBlocks(context.sourceCode);
                  },
                };
              },
            },
          },
        },
      },
      rules: { "capture/jsdoc": "error" },
    },
    { filename: "source.ts" },
  );
  return parsed;
}

// @agent-code-guard/regression-only: attachment matching is a closed AST grammar with exact fixtures.
describe("jsdoc attachments", () => {
  it("attaches only the immediate leading block and maps export wrappers", () => {
    const blocks = parse(`/** Provides the run runtime value. */\nexport function run(value: string): string { return value; }\n\n/** Detached prose. */\n/** The current separator value. */\nconst separator = 1;\nconst next = separator;`);
    expect(blocks[0].attachment).toMatchObject({ symbol: "run", callable: "run(value: string)" });
    expect(blocks[1].attachment).toBeUndefined();
    expect(blocks[2].attachment).toMatchObject({ symbol: "separator" });
  });

  it("derives closed candidates for functions, methods, variables, and type declarations", () => {
    const blocks = parse(`/** Function prose. */
function read(input: string): string { return input; }
class Service {
  /** Method prose. */
  write(value: string): string { return value; }
}
/** Variable prose. */
const resolve = (key: string): string => key;
/** Alias prose. */
type Identifier = string;
/** Interface prose. */
interface RecordShape { value: string; }`);
    expect(blocks.map((block) => block.attachment)).toMatchObject([
      { symbol: "read", callable: "read(input: string)" },
      { symbol: "write", callable: "write(value: string)" },
      { symbol: "resolve", callable: "resolve(key: string)" },
      { symbol: "Identifier", represents: true },
      { symbol: "RecordShape", represents: true },
    ]);
  });

  it("unwraps default and named exports while rejecting detached wrapper prose", () => {
    const blocks = parse(`/** Default function. */
export default function defaulted(value: string) { return value; }
/** Named class. */
export class Exported {}
/** Detached export prose. */
/** Current variable. */
export const current = 1;`);
    expect(blocks.map((block) => block.attachment)).toMatchObject([
      { symbol: "defaulted", callable: "defaulted(value: string)", represents: false },
      { symbol: "Exported", represents: true },
      undefined,
      { symbol: "current", callable: undefined, represents: true },
    ]);
  });

  it("limits attachment candidates to supported declaration shapes", () => {
    const blocks = parse(`/** Enum. */
enum Phase { Start }
/** Multi declaration. */
const first = 1, second = 2;
/** Destructuring. */
const { value } = { value: 1 };
class Example {
  /** Computed method. */
  ["read"](input: string) { return input; }
  /** Private method. */
  #write(value: string) { return value; }
}`);
    expect(blocks.map((block) => block.attachment)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      { symbol: "write", callable: "write(value: string)", represents: false },
    ]);
  });

  it("scans callable parameter text through quotes, escapes, templates, and defaults", () => {
    const blocks = parse("/** Function. */\nfunction scan(value = \")\\\"\", quoted = `x${\")\"}`): void {}\n/** Arrow. */\nconst arrow = (value = `a${\")\"}`, escaped = '\\\\') => value;");
    expect(blocks.map((block) => block.attachment?.callable)).toEqual([
      // eslint-disable-next-line no-useless-escape -- The expected callable includes the source fixture's escaped quote.
      'scan(value = ")\\\"", quoted = `x${")"}`)',
      "arrow(value = `a${\")\"}`, escaped = '\\\\')",
    ]);
  });

  it("keeps each quote family closed while finding a nested default parameter", () => {
    const blocks = parse("/** Single. */\nfunction single(value = ')'): void {}\n/** Double. */\nfunction double(value = \")\"): void {}\n/** Template. */\nfunction template(value = `)`): void {}\n/** Expression. */\nconst expression = function (value = nested(1)): number { return value; };");
    expect(blocks.map((block) => block.attachment?.callable)).toEqual([
      "single(value = ')')",
      'double(value = ")")',
      "template(value = `)`)",
      "expression(value = nested(1))",
    ]);
  });

  it("honors an escaped quote before a parenthesis inside a default string", () => {
    const [block] = parse(String.raw`/** Escaped. */
function escaped(value = "\\\")"): void {}`);
    expect(block.attachment?.callable).toBe(String.raw`escaped(value = "\\\")")`);
  });

  it("does not attach a trailing JSDoc block without a following declaration", () => {
    const [block] = parse("/** End of file. */");
    expect(block.attachment).toBeUndefined();
  });

  it("rejects a JSDoc block superseded by a later comment", () => {
    const blocks = parse(`/** Older documentation. */
/* ordinary intervening comment */
const current = 1;`);
    expect(blocks[0].attachment).toBeUndefined();
  });

  it("does not derive a callable from non-callable expressions containing parentheses", () => {
    const blocks = parse(`/** Unary arrow. */
const unary = value => value;
/** Object value. */
const object = { read(value: string) { return value; } };`);
    expect(blocks.map((block) => block.attachment)).toEqual([
      { symbol: "unary", callable: undefined, represents: true },
      { symbol: "object", callable: undefined, represents: true },
    ]);
  });

  it("does not scan beyond a terminal unary arrow expression", () => {
    const [block] = parse("/** Terminal unary arrow. */\nconst unary = (value => value);");
    expect(block.attachment).toEqual({ symbol: "unary", callable: undefined, represents: true });
  });
});
