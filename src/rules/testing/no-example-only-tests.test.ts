/**
 * @file Exercises the example-count threshold that separates a suite carried by
 * examples alone from one backed by property evidence or a stated regression.
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { lintRule } from "../test-support/property-lint.js";

const TEST_FILENAME = "src/example.test.ts";

const testFunctionArb = fc.constantFrom("it", "test");
const propertyPatternArb = fc.constantFrom(
  "fc.assert(fc.property(fc.integer(), (value) => { expect(value).toBe(value); }));",
  "fc.assert(fc.asyncProperty(fc.integer(), async (value) => { expect(value).toBe(value); }));",
  "it.prop([fc.integer()])('property case', (value) => { expect(value).toBe(value); });",
  "test.prop([fc.integer()])('property case', (value) => { expect(value).toBe(value); });",
);

describe("property: example-only tests", () => {
  it("example-only scopes fire once they cross the example threshold", () => {
    fc.assert(
      fc.property(testFunctionArb, fc.integer({ min: 4, max: 8 }), (testFn, count) => {
        const code = exampleTests(testFn, count).join("\n");
        const messages = lintRule(code, "agent-code-guard/no-example-only-tests", TEST_FILENAME);
        expect(messages).toHaveLength(1);
        expect(messages[0]?.message).toContain(`${count} example tests`);
      }),
      { numRuns: 30 },
    );
  });

  it("property evidence suppresses broad example scopes without relying on test titles", () => {
    fc.assert(
      fc.property(
        testFunctionArb,
        fc.integer({ min: 2, max: 6 }),
        propertyPatternArb,
        (testFn, count, propertyCode) => {
          const code = [...exampleTests(testFn, count), propertyCode].join("\n");
          expect(
            lintRule(code, "agent-code-guard/no-example-only-tests", TEST_FILENAME),
          ).toHaveLength(0);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("single regression tests and explicit regression-only files stay clean", () => {
    fc.assert(
      fc.property(testFunctionArb, (testFn) => {
        const single = exampleTests(testFn, 1).join("\n");
        const regressionOnly =
          "// @agent-code-guard/regression-only: reproduces a historical parser crash\n" +
          exampleTests(testFn, 3).join("\n");
        expect(
          lintRule(single, "agent-code-guard/no-example-only-tests", TEST_FILENAME),
        ).toHaveLength(0);
        expect(
          lintRule(regressionOnly, "agent-code-guard/no-example-only-tests", TEST_FILENAME),
        ).toHaveLength(0);
      }),
      { numRuns: 10 },
    );
  });
});

function exampleTests(testFn: string, count: number): readonly string[] {
  const tests: string[] = [];
  for (let index = 0; index < count; index += 1) {
    tests.push(`${testFn}('case ${index}', () => { expect(${index}).toBe(${index}); });`);
  }
  return tests;
}
