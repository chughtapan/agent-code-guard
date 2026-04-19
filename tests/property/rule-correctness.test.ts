import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import * as fc from "fast-check";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";
import plugin from "../../src/index.js";

const RECOMMENDED_RULE_IDS = Object.keys(plugin.configs.recommended.rules);

function baseConfig(rules: Linter.RulesRecord): Linter.Config {
  return {
    files: ["**/*.ts", "**/*.js"],
    languageOptions: {
      parser: tsParser as unknown as Linter.Parser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "agent-code-guard": plugin as unknown as NonNullable<Linter.Config["plugins"]>[string] },
    rules,
  };
}

const linter = new Linter();

function lintAll(code: string, filename: string = "test.ts"): Linter.LintMessage[] {
  return linter.verify(code, baseConfig(plugin.configs.recommended.rules), {
    filename,
  });
}

function lintOne(code: string, ruleId: string, filename: string = "test.ts"): Linter.LintMessage[] {
  return linter.verify(code, baseConfig({ [ruleId]: "error" }), {
    filename,
  });
}

function isSyntacticallyValid(code: string): boolean {
  const sf = ts.createSourceFile(
    "test.ts",
    code,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  const diags = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  return !diags || diags.length === 0;
}

// Safe-grammar generator: syntactically valid TS sources that should not trip
// any recommended rule. Narrow shapes only: literal const decls, typed decls,
// and plain (non-async) function decls.
const identArb = fc
  .stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/)
  .filter((s) => !RESERVED.has(s));

const RESERVED = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
  "false", "finally", "for", "function", "if", "import", "in", "instanceof",
  "let", "new", "null", "of", "return", "super", "switch", "this", "throw",
  "true", "try", "typeof", "var", "void", "while", "with", "yield", "as",
  "then", "query", "mock", "spyOn", "hoisted",
]);

const safeStringArb = fc
  .stringMatching(/^[a-z]{0,12}$/)
  .map((s) => `"${s}"`);
const safeNumberArb = fc.integer({ min: 0, max: 1000 }).map((n) => String(n));
const safeBoolArb = fc.constantFrom("true", "false");

const safeLiteralArb = fc.oneof(safeStringArb, safeNumberArb, safeBoolArb);

const literalDeclArb = fc
  .tuple(identArb, safeLiteralArb)
  .map(([id, lit]) => `const ${id} = ${lit};`);

const typedDeclArb = fc
  .tuple(identArb, fc.constantFrom("number", "string", "boolean"))
  .chain(([id, ty]) => {
    const litArb =
      ty === "number" ? safeNumberArb : ty === "string" ? safeStringArb : safeBoolArb;
    return litArb.map((lit) => `const ${id}: ${ty} = ${lit};`);
  });

const plainFnArb = fc
  .tuple(identArb, identArb, safeNumberArb)
  .map(([fname, pname, n]) =>
    `function ${fname}(${pname}: number): number { return ${pname} + ${n}; }`,
  );

const safeStmtArb = fc.oneof(literalDeclArb, typedDeclArb, plainFnArb);

const safeSourceArb = fc
  .array(safeStmtArb, { minLength: 1, maxLength: 5 })
  .map((stmts) => stmts.join("\n"));

describe("property: rule correctness", () => {
  it("Property 1: no recommended rule fires on safe TS sources", () => {
    fc.assert(
      fc.property(safeSourceArb, (code) => {
        if (!isSyntacticallyValid(code)) return; // skip, not fail
        const messages = lintAll(code);
        if (messages.length !== 0) {
          throw new Error(
            `Safe source produced ${messages.length} report(s):\n` +
              `--- source ---\n${code}\n--- reports ---\n` +
              messages
                .map((m) => `  [${m.ruleId ?? "?"}] ${m.message}`)
                .join("\n"),
          );
        }
      }),
      { numRuns: 200 },
    );
  });

  // Seed anti-pattern per rule (lifted from the first invalid case of each
  // rule's hand-written test). Also records ruleIds that may legitimately
  // co-fire with the seed — empty for all current seeds, but kept as a slot
  // so a reviewer can whitelist a future co-firing without loosening the
  // assertion.
  const SEEDS: ReadonlyArray<{
    ruleId: string;
    seed: string;
    coFire: ReadonlyArray<string>;
    filename?: string;
  }> = [
    { ruleId: "agent-code-guard/async-keyword", seed: "async function foo() {}", coFire: [] },
    {
      ruleId: "agent-code-guard/promise-type",
      seed: "function foo(): Promise<number> { return Promise.resolve(1); }",
      coFire: [],
    },
    {
      ruleId: "agent-code-guard/then-chain",
      seed: "Promise.resolve(1).then((v) => v);",
      coFire: [],
    },
    {
      ruleId: "agent-code-guard/bare-catch",
      seed: "try { doThing(); } catch {}",
      coFire: [],
    },
    {
      ruleId: "agent-code-guard/record-cast",
      seed: "const r = {} as Record<string, unknown>;",
      coFire: [],
    },
    {
      ruleId: "agent-code-guard/no-raw-sql",
      seed: "db.query('SELECT * FROM users');",
      coFire: [],
    },
    {
      ruleId: "agent-code-guard/no-manual-enum-cast",
      seed: "const s = x as 'active' | 'inactive';",
      coFire: [],
    },
    {
      ruleId: "agent-code-guard/no-hardcoded-secrets",
      seed: "const apiKey = 'sk_live_abc123xyz0987654321';",
      coFire: [],
    },
    {
      ruleId: "agent-code-guard/no-raw-throw-new-error",
      seed: "throw new Error('boom');",
      coFire: [],
    },
    {
      ruleId: "agent-code-guard/no-test-skip-only",
      seed: "it.skip('wip', () => {});",
      coFire: [],
      filename: "src/auth.test.ts",
    },
    {
      ruleId: "agent-code-guard/no-coverage-threshold-gate",
      seed: "module.exports = { coverageThreshold: { global: { lines: 80 } } };",
      coFire: [],
      filename: "jest.config.js",
    },
    {
      ruleId: "safer-by-default/no-hardcoded-assertion-literals",
      seed: 'expect(result).toBe("processed");',
      coFire: [],
      filename: "src/foo.test.ts",
    },
  ];

  const renameArb = fc
    .stringMatching(/^[a-z][a-zA-Z0-9]{0,6}$/)
    .filter((s) => !RESERVED.has(s));

  const paddingArb = fc.constantFrom("", " ", "\n", "  ", "\n\n", "\t");

  // Small, rule-preserving mutations: whitespace padding + identifier rename
  // of a single target ident. Rename is applied as whole-word replace so
  // substrings of keywords are untouched.
  function mutate(seed: string, pad: string, ident: string, rename: string): string {
    const renamed =
      ident.length > 0
        ? seed.replace(new RegExp(`\\b${escapeRegex(ident)}\\b`, "g"), rename)
        : seed;
    return `${pad}${renamed}${pad}`;
  }

  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const IDENTS_BY_SEED: Record<string, string> = {
    "agent-code-guard/async-keyword": "foo",
    "agent-code-guard/promise-type": "foo",
    "agent-code-guard/then-chain": "", // no rename target — `.then` is the trigger
    "agent-code-guard/bare-catch": "doThing",
    "agent-code-guard/record-cast": "r",
    "agent-code-guard/no-raw-sql": "db",
    "agent-code-guard/no-manual-enum-cast": "s",
    // Rename exercises the value-shape detector added in acg#10: the seed's
    // LHS is `apiKey`, mutation renames it to a random non-secret-looking
    // ident, and the rule still fires because `sk_live_...` matches the
    // Stripe canonical shape regex.
    "agent-code-guard/no-hardcoded-secrets": "apiKey",
    "agent-code-guard/no-raw-throw-new-error": "",
    "agent-code-guard/no-test-skip-only": "",
    "agent-code-guard/no-coverage-threshold-gate": "",
    // Rename exercises the argument identifier; the string literal "processed" still fires
    "agent-code-guard/no-hardcoded-assertion-literals": "result",
  };

  for (const { ruleId, seed, coFire, filename } of SEEDS) {
    it(`Property 2: ${ruleId} fires on its anti-pattern across mutations`, () => {
      const targetIdent = IDENTS_BY_SEED[ruleId] ?? "";
      fc.assert(
        fc.property(paddingArb, renameArb, (pad, rename) => {
          const code = mutate(seed, pad, targetIdent, rename);
          if (!isSyntacticallyValid(code)) return;
          const allMessages = lintAll(code, filename);
          const firedIds = new Set(
            allMessages
              .map((m) => m.ruleId)
              .filter((id): id is string => id != null),
          );
          const ownFired = firedIds.has(ruleId);
          const unexpected = [...firedIds].filter(
            (id) => id !== ruleId && !coFire.includes(id),
          );
          if (!ownFired || unexpected.length > 0) {
            throw new Error(
              `Mutation broke expectations for ${ruleId}:\n` +
                `--- source ---\n${code}\n` +
                `--- own fired: ${ownFired} ---\n` +
                `--- unexpected: ${unexpected.join(", ") || "(none)"} ---\n` +
                `--- all reports ---\n` +
                allMessages
                  .map((m) => `  [${m.ruleId ?? "?"}] ${m.message}`)
                  .join("\n"),
            );
          }
        }),
        { numRuns: 20 },
      );
    });
  }

  // Property 4: no-hardcoded-assertion-literals does not fire on structural assertions.
  // Structural = identifier or member-expression as the expected arg, never a literal.
  it("Property 4: no-hardcoded-assertion-literals: structural assertions are not flagged", () => {
    const RULE_ID = "safer-by-default/no-hardcoded-assertion-literals";
    const MATCHER_ARB = fc.constantFrom("toBe", "toEqual", "toStrictEqual", "toContain");
    fc.assert(
      fc.property(identArb, identArb, MATCHER_ARB, (actual, expected, matcher) => {
        const code = `expect(${actual}).${matcher}(${expected});`;
        if (!isSyntacticallyValid(code)) return;
        const messages = lintOne(code, RULE_ID, "src/foo.test.ts");
        if (messages.length !== 0) {
          throw new Error(
            `Structural assertion falsely flagged:\n--- source ---\n${code}\n` +
              messages.map((m) => `  [${m.ruleId ?? "?"}] ${m.message}`).join("\n"),
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  // Property 3: fixer idempotence. Scoped to rules that declare `fixable`.
  // No recommended rule currently declares one — this is a guard that will
  // light up once a fixer lands.
  const FIXABLE_RULE_IDS = Object.entries(plugin.rules)
    .filter(([, r]) => r.meta.fixable)
    .map(([name]) => `agent-code-guard/${name}`);

  it("Property 3: fixer idempotence (skipped if no fixable rules)", () => {
    if (FIXABLE_RULE_IDS.length === 0) {
      expect(FIXABLE_RULE_IDS).toHaveLength(0);
      return;
    }
    for (const ruleId of FIXABLE_RULE_IDS) {
      const entry = SEEDS.find((s) => s.ruleId === ruleId);
      if (entry === undefined) continue;
      const filename = entry.filename ?? "test.ts";
      const { output } = linter.verifyAndFix(
        entry.seed,
        baseConfig({ [ruleId]: "error" }),
        { filename },
      );
      const after = lintOne(output, ruleId, filename);
      expect(after, `Fixer for ${ruleId} not idempotent: ${after.length} report(s) remain`).toHaveLength(0);
    }
  });
});
