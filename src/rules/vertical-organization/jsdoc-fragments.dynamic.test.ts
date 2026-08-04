import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import { describe, expect, it, vi } from "vitest";

/* eslint-disable agent-code-guard/no-example-only-tests, agent-code-guard/require-assertion-rationale, max-statements-per-line, @typescript-eslint/consistent-type-imports, @typescript-eslint/naming-convention -- Dynamic module reload contracts require compact mock wiring and exact range assertions. */

async function parseDynamically(code: string) {
  vi.resetModules();
  const { parseJsdocBlocks } = await import("./jsdoc-fragments.js");
  const linter = new Linter();
  let blocks: ReturnType<typeof parseJsdocBlocks> = [];
  linter.verify(code, {
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
    plugins: { capture: { rules: { jsdoc: { meta: { type: "problem", schema: [], messages: { captured: "captured" } }, create(context) { return { "Program:exit"() { blocks = parseJsdocBlocks(context.sourceCode); } }; } } } } },
    rules: { "capture/jsdoc": "error" },
  }, { filename: "source.ts" });
  return blocks;
}

describe("dynamic JSDoc fragment module", () => {
  it.each(["param", "arg", "argument", "property", "prop"])("loads the %s named-tag alias under mutation", async (tag) => {
    const [block] = await parseDynamically(`/** @${tag} {string} value prose */\nexport {};`);
    expect(block.tags[0].description).toMatchObject({ tagName: "value", text: "prose " });
  });

  it("filters ordinary comments when the parser module is loaded under mutation", async () => {
    const blocks = await parseDynamically("//** line\n/* ordinary */\n/** JSDoc. */\nexport {};");
    expect(blocks.map((block) => block.description?.text)).toEqual(["JSDoc. "]);
  });

  it.each(["\n", "\r\n", "\r"])("preserves exact tag ranges across dynamic physical line endings", async (ending) => {
    const source = ["/**", " * @param {string} value prose", " * @returns {string} result", " */", "function read(value: string) { return value; }"].join(ending);
    const [block] = await parseDynamically(source);
    expect(block.tags.map((tag) => source.slice(tag.description!.range[0], tag.description!.range[1]))).toEqual(["prose", "result"]);
  });

  it("keeps an indented first prose byte after a dynamic module reload", async () => {
    const source = "/**\n *   prose\n */\nexport {};";
    const [block] = await parseDynamically(source);
    expect(block.description?.range[0]).toBe(source.indexOf("prose"));
  });

  it("passes the exact token slice and physical parser options", async () => {
    const calls: unknown[][] = [];
    vi.resetModules();
    vi.doMock("comment-parser", async () => {
      const actual = await vi.importActual<typeof import("comment-parser")>("comment-parser");
      return { ...actual, parse: (...arguments_: Parameters<typeof actual.parse>) => {
        calls.push(arguments_);
        return actual.parse(...arguments_);
      } };
    });
    const { parseJsdocBlocks } = await import("./jsdoc-fragments.js");
    const source = "const before = 1;\n/** Exact prose. */\nexport {};";
    const linter = new Linter();
    linter.verify(source, { files: ["**/*.ts"], languageOptions: { parser: tsParser }, plugins: { capture: { rules: { jsdoc: { meta: { type: "problem", schema: [], messages: { captured: "captured" } }, create(context) { return { "Program:exit"() { parseJsdocBlocks(context.sourceCode); } }; } } } } }, rules: { "capture/jsdoc": "error" } }, { filename: "source.ts" });
    expect(calls).toEqual([["/** Exact prose. */", { startLine: 2, spacing: "preserve" }]]);
    vi.doUnmock("comment-parser");
  });
});
