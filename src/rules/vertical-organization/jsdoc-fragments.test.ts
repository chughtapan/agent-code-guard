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

// @agent-code-guard/regression-only: physical comment-parser offsets require exact historical fixtures.
describe("jsdoc fragments", () => {
  it("maps parser-derived one-word and typed tag prose to physical ranges", () => {
    const source = "/**\r\n * @file Overview\r\n * @returns {string} TBD\r\n * @throws {Error} later details\r\n */\r\nfunction read(): string { return \"\"; }";
    const [block] = parse(source);
    expect(block.tags.map((tag) => [tag.tag, tag.description?.text])).toEqual([
      ["file", "Overview"],
      ["returns", "TBD"],
      ["throws", "later details"],
    ]);
    const returnsDescription = block.tags[1].description;
    const throwsDescription = block.tags[2].description;
    if (returnsDescription === undefined || throwsDescription === undefined) {
      throw new Error("Expected parser descriptions for the returns and throws tags.");
    }
    expect(source.slice(returnsDescription.range[0], returnsDescription.range[1])).toBe("TBD");
    expect(source.slice(throwsDescription.range[0], throwsDescription.range[1])).toBe("later details");
  });

  it("ends multiline ranges at the final non-whitespace prose byte", () => {
    const source = "/**\n * @returns {string} useful\n * detail   \n */\nfunction read(): string { return \"\"; }";
    const [block] = parse(source);
    const span = block.tags[0].description;
    expect(span?.text).toBe("useful\ndetail   ");
    if (span === undefined) {
      throw new Error("Expected parser description for the returns tag.");
    }
    expect(source.slice(span.range[0], span.range[1])).toContain("detail");
    expect(source.slice(span.range[0], span.range[1]).endsWith("detail")).toBe(true);
  });

  it("retains every parser-derived file tag in one block", () => {
    const [block] = parse(`/**\n * @file First\n * @file Second\n */\nexport {};`);
    expect(block.tags.filter((tag) => tag.tag === "file")).toHaveLength(2);
  });
});
