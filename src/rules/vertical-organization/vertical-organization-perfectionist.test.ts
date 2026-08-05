import * as tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import perfectionist from "eslint-plugin-perfectionist";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { verticalOrganizationRuleEntries } from "./rule-entries.js";

const linter = new Linter();

function enabledRule(ruleId: string): Linter.Config {
  const entry = verticalOrganizationRuleEntries[ruleId];
  if (!Array.isArray(entry)) {
    throw new Error(`Expected ${ruleId} to have validated options.`);
  }

  return {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2024, sourceType: "module" },
    },
    plugins: { perfectionist },
    rules: { [ruleId]: ["error", entry[1]] },
  };
}

function fix(code: string, ruleId: string): string {
  const result = linter.verifyAndFix(code, enabledRule(ruleId), { filename: "fixture.ts" });
  expect(result.messages).toEqual([]);
  return result.output;
}

describe("vertical-organization Perfectionist PR 1 entries", () => {
  it("ships every approved entry disabled in PR 1", () => {
    expect(Object.keys(verticalOrganizationRuleEntries).sort((left, right) => left.localeCompare(right))).toEqual([
      "@typescript-eslint/adjacent-overload-signatures",
      "agent-code-guard/no-vacuous-jsdoc",
      "agent-code-guard/prefer-stepdown-function-order",
      "agent-code-guard/require-stable-file-shell",
      "import-x/first",
      "jsdoc/require-file-overview",
      "perfectionist/sort-export-attributes",
      "perfectionist/sort-exports",
      "perfectionist/sort-heritage-clauses",
      "perfectionist/sort-import-attributes",
      "perfectionist/sort-imports",
      "perfectionist/sort-named-exports",
      "perfectionist/sort-named-imports",
    ]);
    expect(
      Object.values(verticalOrganizationRuleEntries).every(
        (entry) => entry === "off" || entry[0] === "off",
      ),
    ).toBe(true);
  });

  it("keeps every configured Perfectionist entry disabled", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.entries(verticalOrganizationRuleEntries)),
        ([ruleId, entry]) => {
          if (!ruleId.startsWith("perfectionist/")) {
            return;
          }
          expect(Array.isArray(entry) && entry[0] === "off").toBe(true);
        },
      ),
    );
  });
});

describe("vertical-organization Perfectionist import boundaries", () => {
  it("sorts within, but never across, paired side-effect comment partitions", () => {
    const output = fix(
      [
        'import zebra from "zebra";',
        'import alpha from "alpha";',
        "// agent-code-guard: side-effect-import-begin -- evaluation-order: registration runs first",
        'import "./registration";',
        "// agent-code-guard: side-effect-import-end -- evaluation-order: registration runs first",
        'import zulu from "./zulu";',
        'import amber from "./amber";',
      ].join("\n"),
      "perfectionist/sort-imports",
    );

    expect(output).toBe([
      'import alpha from "alpha";',
      'import zebra from "zebra";',
      "// agent-code-guard: side-effect-import-begin -- evaluation-order: registration runs first",
      'import "./registration";',
      "// agent-code-guard: side-effect-import-end -- evaluation-order: registration runs first",
      'import amber from "./amber";',
      'import zulu from "./zulu";',
      ].join("\n"));
  });

  it("keeps comment partitions intact for source-bearing re-exports", () => {
    const output = fix(
      ['export { zebra } from "zebra";', "// reviewed export boundary", 'export { alpha } from "alpha";'].join("\n"),
      "perfectionist/sort-exports",
    );

    expect(output).toContain('export { zebra } from "zebra";\n// reviewed export boundary\nexport { alpha } from "alpha";');
  });
});

describe("vertical-organization Perfectionist syntax surfaces", () => {
  it("sorts named import and export specifiers with the pinned option shape", () => {
    expect(fix('import { zebra, alpha } from "package";', "perfectionist/sort-named-imports")).toBe(
      'import { alpha, zebra } from "package";',
    );
    expect(fix("const zebra = 1; const alpha = 2; export { zebra, alpha };", "perfectionist/sort-named-exports")).toBe(
      "const zebra = 1; const alpha = 2; export { alpha, zebra };",
    );
  });

  it("sorts import/export attributes and heritage clauses", () => {
    expect(
      fix('import data from "./data.json" with { zebra: "z", alpha: "a" };', "perfectionist/sort-import-attributes"),
    ).toBe('import data from "./data.json" with { alpha: "a", zebra: "z" };');
    expect(
      fix('export { data } from "./data.json" with { zebra: "z", alpha: "a" };', "perfectionist/sort-export-attributes"),
    ).toBe('export { data } from "./data.json" with { alpha: "a", zebra: "z" };');
    expect(fix("interface Subject extends Zebra, Alpha {}", "perfectionist/sort-heritage-clauses")).toBe(
      "interface Subject extends Alpha, Zebra {}",
    );
  });
});

describe("vertical-organization Perfectionist import options", () => {
  it("pins the only import-order safety options to comment partitioning and unsorted side effects", () => {
    expect(verticalOrganizationRuleEntries["perfectionist/sort-imports"]).toEqual([
      "off",
      {
        ignoreCase: true,
        newlinesBetween: "ignore",
        order: "asc",
        partitionByComment: true,
        sortSideEffects: false,
        specialCharacters: "keep",
        type: "alphabetical",
      },
    ]);
  });
});
