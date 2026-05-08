import * as fc from "fast-check";
import { expect, it } from "vitest";
import plugin from "../index.js";
import {
  baseConfig,
  FIXABLE_RULE_IDS,
  identArb,
  isSyntacticallyValid,
  linter,
  lintOne,
  messageDetails,
  safeStringArb,
  SEEDS,
} from "./test-support/rule-correctness-fixtures.js";

it("Property 3: fixer idempotence is guarded once fixable rules exist", () => {
  if (FIXABLE_RULE_IDS.length === 0) {
    expect(FIXABLE_RULE_IDS).toHaveLength(0);
    return;
  }
  for (const ruleId of FIXABLE_RULE_IDS) {
    assertFixerIdempotence(ruleId);
  }
});

it("Property 4: structural assertions are not hardcoded assertion literals", () => {
  const ruleId = "agent-code-guard/no-hardcoded-assertion-literals";
  const matcherArb = fc.constantFrom("toBe", "toEqual", "toStrictEqual", "toContain");
  expect.hasAssertions();
  fc.assert(
    fc.property(identArb, identArb, matcherArb, (actual, expected, matcher) => {
      const code = `expect(${actual}).${matcher}(${expected});`;
      if (!isSyntacticallyValid(code)) return;
      expectMessagesCleanInFile(code, ruleId, "src/foo.test.ts");
    }),
    { numRuns: 100 },
  );
});

it("Property 5: hardcoded assertion literals fire across assertion APIs", () => {
  const ruleId = "agent-code-guard/no-hardcoded-assertion-literals";
  fc.assert(expectMatchersFlagLiterals(ruleId), { numRuns: 40 });
  fc.assert(assertMembersFlagLiterals(ruleId), { numRuns: 30 });
  fc.assert(negativeNumbersFlag(ruleId), { numRuns: 20 });
});

it("Property 6: no-process-env-at-runtime ignores shadowed process bindings", () => {
  const ruleId = "agent-code-guard/no-process-env-at-runtime";
  expect.hasAssertions();
  fc.assert(
    fc.property(identArb, safeStringArb, (key, value) => {
      const code =
        `const process = { env: { ${key}: ${value} } };\n` +
        `const current = process.env.${key};`;
      if (!isSyntacticallyValid(code)) return;
      expectMessagesClean(code, ruleId);
    }),
    { numRuns: 100 },
  );
});

it("Property 7: no-unbounded-concurrency ignores bounded Effect fan-out", () => {
  const ruleId = "agent-code-guard/no-unbounded-concurrency";
  const methodArb = fc.constantFrom("all", "forEach", "validateAll");
  expect.hasAssertions();
  fc.assert(
    fc.property(methodArb, fc.integer({ min: 1, max: 64 }), (method, concurrency) => {
      const code = boundedConcurrencySource(method, concurrency);
      if (!isSyntacticallyValid(code)) return;
      expectMessagesClean(code, ruleId);
    }),
    { numRuns: 100 },
  );
});

it("recommended preset wires sonarjs/no-hardcoded-secrets so secret-detection still ships", () => {
  expect(plugin.configs.recommended.rules).toHaveProperty(
    "sonarjs/no-hardcoded-secrets",
    "error",
  );
  expect(plugin.configs.recommended.plugins).toHaveProperty("sonarjs");
});

function assertFixerIdempotence(ruleId: string): void {
  const entry = SEEDS.find((seed) => seed.ruleId === ruleId);
  if (entry === undefined) return;
  const filename = entry.filename ?? "test.ts";
  const { output } = linter.verifyAndFix(
    entry.seed,
    baseConfig({ [ruleId]: "error" }),
    { filename },
  );
  expect(lintOne(output, ruleId, filename)).toHaveLength(0);
}

function expectMessagesClean(code: string, ruleId: string): void {
  expectMessagesCleanInFile(code, ruleId, "test.ts");
}

function expectMessagesCleanInFile(code: string, ruleId: string, filename: string): void {
  const messages = lintOne(code, ruleId, filename);
  expect(messages, `${code}\n${messageDetails(messages)}`).toHaveLength(0);
}

function expectMatchersFlagLiterals(ruleId: string): fc.IPropertyWithHooks<[string, string, string, string]> {
  const matcherArb = fc.constantFrom("toBe", "toEqual", "toStrictEqual", "toContain", "toMatch");
  return fc.property(
    identArb,
    identArb,
    matcherArb,
    stringLiteralArb(),
    (actual, _expected, matcher, literal) => {
      const code = `expect(${actual}).${matcher}(${literal});`;
      expect(lintOne(code, ruleId, "src/foo.test.ts")).not.toHaveLength(0);
    },
  );
}

function assertMembersFlagLiterals(ruleId: string): fc.IPropertyWithHooks<[string, string, string, string]> {
  const memberAssertArb = fc.constantFrom("equal", "strictEqual", "deepEqual");
  return fc.property(
    identArb,
    identArb,
    memberAssertArb,
    stringLiteralArb(),
    (actual, _expected, matcher, literal) => {
      const code = `assert.${matcher}(${actual}, ${literal});`;
      expect(lintOne(code, ruleId, "src/foo.test.ts")).not.toHaveLength(0);
    },
  );
}

function negativeNumbersFlag(ruleId: string): fc.IPropertyWithHooks<[string, string]> {
  const negativeNumberArb = fc.integer({ min: 3, max: 200 }).map((value) => `-${value}`);
  return fc.property(identArb, negativeNumberArb, (actual, literal) => {
    const code = `expect(${actual}).toBe(${literal});`;
    expect(lintOne(code, ruleId, "src/foo.test.ts")).not.toHaveLength(0);
  });
}

function boundedConcurrencySource(method: string, concurrency: number): string {
  if (method === "forEach") {
    return `yield* Effect.${method}(tasks, runTask, { concurrency: ${concurrency} });`;
  }
  return `yield* Effect.${method}(tasks, { concurrency: ${concurrency} });`;
}

function stringLiteralArb(): fc.Arbitrary<string> {
  return fc.stringMatching(/^[a-z]{4,12}$/).map((value) => JSON.stringify(value));
}

