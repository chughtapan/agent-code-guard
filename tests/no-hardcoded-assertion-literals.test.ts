import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-hardcoded-assertion-literals.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
});

ruleTester.run("no-hardcoded-assertion-literals", rule, {
  valid: [
    { filename: "/repo/src/auth.test.ts", code: "expect(x).toBe('ok');" },
    { filename: "/repo/src/auth.test.ts", code: "expect(arr.length).toBe(0);" },
    { filename: "/repo/src/auth.test.ts", code: "expect(count).toBe(1);" },
    { filename: "/repo/src/auth.test.ts", code: "expect(result).toBe(-1);" },
    { filename: "/repo/src/auth.test.ts", code: "expect(arr.length).toBe(2);" },
    {
      filename: "/repo/src/auth.test.ts",
      code: "const EXPECTED = 'processed'; expect(x).toBe(EXPECTED);",
    },
    { filename: "/repo/src/auth.test.ts", code: "expect(x).toBe(Status.Active);" },
    // Non-test file — rule is silent outside test files
    { filename: "/repo/src/auth.ts", code: "expect(x).toBe('hardcoded-value');" },
    { filename: "/repo/src/auth.test.ts", code: "expect(x).toBe(`prefix-${id}`);" },
    {
      filename: "/repo/src/auth.test.ts",
      code: "expect(x).toBe('process');",
      options: [{ allowShorterThan: 10 }],
    },
    { filename: "/repo/tests/auth.ts", code: "assert.equal(result, EXPECTED_STATUS);" },
    // .toHaveLength is not in the detected matcher set
    { filename: "/repo/src/auth.test.ts", code: "expect(arr).toHaveLength(10);" },
    // Regex arg to toMatch is not a string literal
    { filename: "/repo/src/auth.test.ts", code: "expect(msg).toMatch(/error/);" },
    { filename: "/repo/src/auth.test.ts", code: "assertEquals(result, EXPECTED);" },
  ],
  invalid: [
    // vitest/.toBe with string literal (length ≥ 4)
    {
      filename: "/repo/src/auth.test.ts",
      code: "expect(result).toBe('processed');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // vitest/.toEqual with string literal
    {
      filename: "/repo/src/auth.test.ts",
      code: "expect(result).toEqual('active');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // vitest/.toStrictEqual with string literal
    {
      filename: "/repo/src/auth.test.ts",
      code: "expect(result).toStrictEqual('pending');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // vitest/.toContain with string literal
    {
      filename: "/repo/src/auth.test.ts",
      code: "expect(items).toContain('admin');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // vitest/.toMatch with string literal
    {
      filename: "/repo/src/auth.test.ts",
      code: "expect(msg).toMatch('error occurred');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // Magic number (non-boundary)
    {
      filename: "/repo/src/auth.test.ts",
      code: "expect(count).toBe(42);",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // chai/assert.equal — 2nd arg is the expected string
    {
      filename: "/repo/tests/auth.ts",
      code: "assert.equal(result, 'success');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // chai/assert.strictEqual — 2nd arg is a magic number
    {
      filename: "/repo/src/auth.test.ts",
      code: "assert.strictEqual(count, 100);",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // assertEquals (Deno/custom) — 2nd arg
    {
      filename: "/repo/src/auth.test.ts",
      code: "assertEquals(result, 'completed');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // Template literal without substitutions (treated as string literal)
    {
      filename: "/repo/src/auth.test.ts",
      code: "expect(result).toBe(`processed`);",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // .spec.ts file is also a test file
    {
      filename: "/repo/src/auth.spec.ts",
      code: "expect(x).toBe('verified');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // tests/ directory
    {
      filename: "/repo/tests/auth.ts",
      code: "expect(x).toBe('verified');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // assert.deepEqual — 2nd arg
    {
      filename: "/repo/src/auth.test.ts",
      code: "assert.deepEqual(result, 'active-user');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
    // __tests__ directory
    {
      filename: "/repo/src/__tests__/auth.ts",
      code: "expect(x).toEqual('active');",
      errors: [{ messageId: "hardcodedLiteral" }],
    },
  ],
});
