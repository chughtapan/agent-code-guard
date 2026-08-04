import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import { describe, expect, it } from "vitest";
import { type ParsedJsdocBlock, parseJsdocBlocks } from "./jsdoc-fragments.js";

/* eslint-disable max-lines-per-function, sonarjs/max-lines-per-function -- Physical range fixtures share one parser harness and are most legible together. */

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
  it.each([
    ["\n", "LF"],
    ["\r\n", "CRLF"],
    ["\r", "CR"],
  ])("keeps exact physical ranges and locations across %s line endings", (ending, prose) => {
    const source = [
      "/**",
      " * Leading prose   ",
      " * continues here",
      " * @param {string} input Parameter prose   ",
      " * @returns {string} Result prose",
      " */",
      "function read(input: string): string { return input; }",
    ].join(ending);
    const [block] = parse(source);
    const parameter = block.tags[0].description;
    const returns = block.tags[1].description;
    if (block.description === undefined || parameter === undefined || returns === undefined) {
      throw new Error(`Expected descriptions using ${prose} line endings.`);
    }
    expect(block.description).toMatchObject({ kind: "block", text: "Leading prose   \ncontinues here" });
    expect(parameter).toMatchObject({ kind: "tag", tag: "param", tagName: "input", text: "Parameter prose   " });
    expect(returns).toMatchObject({ kind: "tag", tag: "returns", text: "Result prose" });
    expect(source.slice(parameter.range[0], parameter.range[1])).toBe("Parameter prose");
    expect(source.slice(returns.range[0], returns.range[1])).toBe("Result prose");
    expect(parameter.range).toEqual([
      source.indexOf("Parameter prose"),
      source.indexOf("Parameter prose") + "Parameter prose".length,
    ]);
    for (const span of [block.description, parameter, returns]) {
      const slice = source.slice(span.range[0], span.range[1]);
      expect(slice.replace(/(?:\r\n|\r|\n) \* ?/gu, "\n").trimEnd()).toBe(span.text.trimEnd());
      expect(source.slice(span.range[0], span.range[1]).startsWith(" ")).toBe(false);
      expect(source.slice(span.range[0], span.range[1]).endsWith(" ")).toBe(false);
      expect(sourceCodeLocation(source, span.range)).toEqual(span.loc);
    }
  });

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

  it.each(["param", "arg", "argument", "property", "prop"]) (
    "uses the parsed name only for the %s tag family",
    (tag) => {
      const [block] = parse(`/** @${tag} {string} value descriptive text */\nexport {};`);
      expect(block.tags).toEqual([
        expect.objectContaining({
          tag,
          name: "value",
          description: expect.objectContaining({ tag, tagName: "value", text: "descriptive text " }),
        }),
      ]);
    },
  );

  it("does not create spans for whitespace, parser problems, or non-Javadoc comments", () => {
    const blocks = parse(`/* ordinary block */
// line comment
/**
 * ${"  "}
 * @returns {string}${"    "}
 */
const empty = "";
/** Intro prose before a malformed tag.
 * @param {string broken */
function malformed(broken: string) { return broken; }`);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ description: undefined, tags: [{ description: undefined }] });
    expect(blocks[1]).toMatchObject({ description: undefined });
    expect(blocks[1].tags.every((tag) => tag.description === undefined)).toBe(true);
  });

  it("maps a leading description indentation to its first non-whitespace byte", () => {
    const source = "/**\n *   indented prose\n */\nexport {};";
    const [block] = parse(source);
    expect(block.description?.range).toEqual([source.indexOf("indented"), source.indexOf("indented") + "indented prose".length]);
    expect(block.description?.loc).toEqual({ start: { line: 2, column: 5 }, end: { line: 2, column: 19 } });
  });

  it("maps later blocks against the full source while parsing only their token", () => {
    const source = "const before = 1;\n/** First. */\nconst first = 1;\n/** Second. */\nconst second = 2;";
    const blocks = parse(source);
    expect(blocks.map((block) => [block.description?.text, block.description?.range, block.description?.loc.start.line])).toEqual([
      ["First. ", [source.indexOf("First."), source.indexOf("First.") + "First.".length], 2],
      ["Second. ", [source.indexOf("Second."), source.indexOf("Second.") + "Second.".length], 4],
    ]);
  });

  it("rejects line and ordinary block comments even when they resemble JSDoc prose", () => {
    const blocks = parse(`//** line prose
/* * ordinary prose */
/** Documented prose. */
export {};`);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].description?.text).toBe("Documented prose. ");
  });
});

function sourceCodeLocation(source: string, range: readonly [number, number]): { start: { line: number; column: number }; end: { line: number; column: number } } {
  const position = (index: number) => {
    const prefix = source.slice(0, index);
    const lines = prefix.split(/\r\n|\r|\n/u);
    return { line: lines.length, column: lines.at(-1)?.length ?? 0 };
  };
  return { start: position(range[0]), end: position(range[1]) };
}
