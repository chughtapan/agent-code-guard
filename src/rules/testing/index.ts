/**
 * @file Testing rule registry. Exports the family's rule map for the
 * plugin entry; each member rule lives in a sibling file.
 */

import noCoverageThresholdGate from "./no-coverage-threshold-gate.js";
import noExampleOnlyTests from "./no-example-only-tests.js";
import noHardcodedAssertionLiterals from "./no-hardcoded-assertion-literals.js";
import noTestSkipOnly from "./no-test-skip-only.js";
import noVitestMocks from "./no-vitest-mocks.js";

/**
 * Testing rule family. Catches mocks in integration tests, focused/skipped
 * tests landing in main, example-only suites that lack a property-based
 * invariant, coverage-threshold gates that paper over weak suites, and
 * assertion literals that bake answers into the test instead of deriving
 * them.
 */
export const testingRules = {
  "no-vitest-mocks": noVitestMocks,
  "no-test-skip-only": noTestSkipOnly,
  "no-coverage-threshold-gate": noCoverageThresholdGate,
  "no-hardcoded-assertion-literals": noHardcodedAssertionLiterals,
  "no-example-only-tests": noExampleOnlyTests,
} as const;
