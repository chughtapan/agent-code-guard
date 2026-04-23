import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import plugin from "../../src/index.js";

function configFor(ruleId: string): Linter.Config {
  return {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser as unknown as Linter.Parser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: {
      "agent-code-guard":
        plugin as unknown as NonNullable<Linter.Config["plugins"]>[string],
    },
    rules: { [ruleId]: "error" },
  };
}

const linter = new Linter();
const identArb = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);
const transportSuffixArb = fc.constantFrom("Response", "Payload", "State", "Config");
const paddingArb = fc.constantFrom("", " ", "\n", "  ", "\n\n", "\t");
const renameArb = fc.stringMatching(/^[a-z][a-zA-Z0-9]{1,8}$/);

function lintOne(
  code: string,
  ruleId: string,
  filename: string = "src/test.ts",
): Linter.LintMessage[] {
  return linter.verify(code, configFor(ruleId), { filename });
}

function mutate(seed: string, pad: string, ident: string, rename: string): string {
  const renamed =
    ident.length > 0
      ? seed.replace(new RegExp(`\\b${escapeRegex(ident)}\\b`, "g"), rename)
      : seed;
  return `${pad}${renamed}${pad}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("property: manual algebra family", () => {
  it("Property 1: manual-result keeps transport/data variants clean", () => {
    fc.assert(
      fc.property(identArb, transportSuffixArb, (name, suffix) => {
        const code = `type ${name}${suffix} = { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: string };`;
        expect(lintOne(code, "agent-code-guard/manual-result")).toHaveLength(0);
      }),
      { numRuns: 60 },
    );
  });

  it("Property 2: manual-option keeps non-algebraic state wrappers clean", () => {
    fc.assert(
      fc.property(identArb, (name) => {
        const code = `type ${name}State<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };`;
        expect(lintOne(code, "agent-code-guard/manual-option")).toHaveLength(0);
      }),
      { numRuns: 60 },
    );
  });

  it("Property 3: manual-brand keeps payload/schema variants clean", () => {
    fc.assert(
      fc.property(identArb, (name) => {
        const payload = `type ${name}Payload = { readonly brand: string; readonly id: string };`;
        const schema = `const ${name}Schema = Schema.String.pipe(Schema.brand("${name}"));`;
        expect(lintOne(payload, "agent-code-guard/manual-brand")).toHaveLength(0);
        expect(lintOne(schema, "agent-code-guard/manual-brand")).toHaveLength(0);
      }),
      { numRuns: 60 },
    );
  });

  it("Property 4: manual-result still fires under rename and whitespace mutation", () => {
    const seed = `
      const Result = {
        ok: (value: number) => ({ ok: true as const, value }),
        err: (error: Error) => ({ ok: false as const, error }),
        match: (input: unknown) => input,
      };
    `;
    fc.assert(
      fc.property(paddingArb, renameArb, (pad, rename) => {
        const code = mutate(seed, pad, "input", rename);
        expect(lintOne(code, "agent-code-guard/manual-result")).toHaveLength(1);
      }),
      { numRuns: 30 },
    );
  });

  it("Property 5: manual-option still fires under rename and whitespace mutation", () => {
    const seed = `
      const Option = {
        some: (value: number) => ({ _tag: "Some" as const, value }),
        none: { _tag: "None" as const },
        flatMap: (apply: (value: number) => unknown) => apply(1),
      };
    `;
    fc.assert(
      fc.property(paddingArb, renameArb, (pad, rename) => {
        const code = mutate(seed, pad, "apply", rename);
        expect(lintOne(code, "agent-code-guard/manual-option")).toHaveLength(1);
      }),
      { numRuns: 30 },
    );
  });

  it("Property 6: manual-brand still fires under rename and whitespace mutation", () => {
    const seed = 'const asUserId = (value: string): UserId => value as UserId;';
    fc.assert(
      fc.property(paddingArb, renameArb, (pad, rename) => {
        const code = mutate(seed, pad, "value", rename);
        expect(lintOne(code, "agent-code-guard/manual-brand")).toHaveLength(1);
      }),
      { numRuns: 30 },
    );
  });

  it("Property 7: manual-result still fires on helper functions under rename and whitespace mutation", () => {
    const seed = "function ok(value: number) { return { ok: true as const, value }; }";
    fc.assert(
      fc.property(paddingArb, renameArb, (pad, rename) => {
        const code = mutate(seed, pad, "value", rename);
        expect(lintOne(code, "agent-code-guard/manual-result")).toHaveLength(1);
      }),
      { numRuns: 30 },
    );
  });

  it("Property 8: manual-option still fires on helper functions under rename and whitespace mutation", () => {
    const seed = 'const some = (value: number) => ({ _tag: "Some" as const, value });';
    fc.assert(
      fc.property(paddingArb, renameArb, (pad, rename) => {
        const code = mutate(seed, pad, "value", rename);
        expect(lintOne(code, "agent-code-guard/manual-option")).toHaveLength(1);
      }),
      { numRuns: 30 },
    );
  });
});
