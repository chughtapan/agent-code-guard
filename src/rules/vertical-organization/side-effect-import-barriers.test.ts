import { Linter } from "eslint";
import { describe, expect, it, vi } from "vitest";
import { AST_TOKEN_TYPES } from "@typescript-eslint/utils";
import * as tsParser from "@typescript-eslint/parser";
import {
  hasLineAdjacentGap,
  parseSideEffectImportBarrier,
} from "./side-effect-import-barriers.js";

function sourceFor(code: string, filename = "barriers.ts") {
  let sourceCode: Parameters<typeof parseSideEffectImportBarrier>[0] | undefined;
  const linter = new Linter();
  linter.verify(
    code,
    {
      files: ["**/*.ts", "**/*.tsx"],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: "module" } },
      plugins: {
        capture: {
          rules: {
            source: {
              meta: { schema: [], messages: {} },
              create(context) {
                sourceCode = context.sourceCode;
                return {};
              },
            },
          },
        },
      },
      rules: { "capture/source": "error" },
    },
    { filename },
  );
  if (sourceCode === undefined) {
    throw new Error("Expected ESLint to provide SourceCode.");
  }
  return sourceCode;
}

describe("side-effect-import barriers", () => {
  it("evaluates marker constants after a fresh module load", async () => {
    vi.resetModules();
    const { parseSideEffectImportBarrier: freshParse } = await import("./side-effect-import-barriers.js");
    for (const [comment, expected] of [
      ["// agent-code-guard: side-effect-import-begin -- evaluation-order: registration", { kind: "begin", reason: "registration" }],
      ["// agent-code-guard: side-effect-import-end -- evaluation-order: registration", { kind: "end", reason: "registration" }],
      ["/* agent-code-guard: side-effect-import-begin -- evaluation-order: registration */", undefined],
      ["// unrelated", undefined],
      ["// agent-code-guard: side-effect-import-begin registration", undefined],
      ["// agent-code-guard: side-effect-import-begin -- evaluation-order:  ", undefined],
    ] as const) {
      const sourceCode = sourceFor(`${comment}\nexport {};`);
      expect(freshParse(sourceCode, sourceCode.getAllComments()[0])).toEqual(expected);
    }
  });

  it.each([
    ["// agent-code-guard: side-effect-import-begin -- evaluation-order: registration", { kind: "begin", reason: "registration" }],
    ["// agent-code-guard: side-effect-import-end -- evaluation-order:  registration  ", { kind: "end", reason: "registration" }],
    ["/* agent-code-guard: side-effect-import-begin -- evaluation-order: registration */", undefined],
    ["// agent-code-guard: side-effect-import-begin-- evaluation-order: registration", undefined],
    ["// agent-code-guard: side-effect-import-start -- evaluation-order: registration", undefined],
    ["// agent-code-guard: side-effect-import-begin -- evaluation-order:    ", undefined],
    ["// agent-code-guard: side-effect-import-begin -- ordering: registration", undefined],
    ["// unrelated", undefined],
  ] as const)("parses exact marker grammar: %s", (comment, expected) => {
    const sourceCode = sourceFor(`${comment}\nexport {};`);
    const token = sourceCode.getAllComments()[0];
    expect(parseSideEffectImportBarrier(sourceCode, token)).toEqual(expected);
  });

  it.each([
    ["// left\nimport value from \"./value\";", true],
    ["// left\r\n\timport value from \"./value\";", true],
    ["// left\n\nimport value from \"./value\";", false],
    ["// left\n// middle\nimport value from \"./value\";", false],
  ] as const)("requires exactly one whitespace-only line boundary", (code, expected) => {
    const sourceCode = sourceFor(code);
    const [comment] = sourceCode.getAllComments();
    const [statement] = sourceCode.ast.body;
    expect(hasLineAdjacentGap(sourceCode, comment, statement)).toBe(expected);
  });
});

describe("side-effect-import barrier token kinds", () => {
  it("rejects a non-line token whose source text opens with the marker", () => {
    const marker = "// agent-code-guard: side-effect-import-begin -- evaluation-order: registration";
    const sourceCode = sourceFor(`const banner = <div>${marker}</div>;\nexport {};`, "barriers.tsx");
    const token = sourceCode.getTokenByRangeStart(sourceCode.text.indexOf(marker));
    if (token === null) {
      throw new Error("Expected a token starting at the marker text.");
    }
    expect(token.type).toBe(AST_TOKEN_TYPES.JSXText);
    expect(parseSideEffectImportBarrier(sourceCode, token)).toBeUndefined();
  });
});
