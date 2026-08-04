import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";
import { type ParsedJsdocBlock, parseJsdocBlocks  } from "./jsdoc-fragments.js";

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

describe("jsdoc fragments", () => {
  it("maps parser-derived one-word and typed tag prose to physical ranges", () => {
    const source = "/**\r\n * @file Overview\r\n * @returns {string} TBD\r\n * @throws {Error} later details\r\n */\r\nfunction read(): string { return \"\"; }";
    const [block] = parse(source);
    expect(block.tags.map((tag) => [tag.tag, tag.description?.text])).toEqual([
      ["file", "Overview"],
      ["returns", "TBD"],
      ["throws", "later details"],
    ]);
    expect(source.slice(block.tags[1].description?.range[0], block.tags[1].description?.range[1])).toBe("TBD");
    expect(source.slice(block.tags[2].description?.range[0], block.tags[2].description?.range[1])).toBe("later details");
  });

  it("ends multiline ranges at the final non-whitespace prose byte", () => {
    const source = "/**\n * @returns {string} useful\n * detail   \n */\nfunction read(): string { return \"\"; }";
    const [block] = parse(source);
    const span = block.tags[0].description;
    expect(span?.text).toBe("useful\ndetail   ");
    expect(source.slice(span?.range[0], span?.range[1])).toContain("detail");
    expect(source.slice(span?.range[0], span?.range[1]).endsWith("detail")).toBe(true);
  });

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

  it("retains every parser-derived file tag in one block", () => {
    const [block] = parse(`/**\n * @file First\n * @file Second\n */\nexport {};`);
    expect(block.tags.filter((tag) => tag.tag === "file")).toHaveLength(2);
  });
});
