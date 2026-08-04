import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";
import { type ParsedJsdocBlock, parseJsdocBlocks } from "./jsdoc-fragments.js";

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
});
