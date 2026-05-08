import noCoverageThresholdGate from "./no-coverage-threshold-gate.js";
import noExampleOnlyTests from "./no-example-only-tests.js";
import noHardcodedAssertionLiterals from "./no-hardcoded-assertion-literals.js";
import noTestSkipOnly from "./no-test-skip-only.js";
import noVitestMocks from "./no-vitest-mocks.js";

export const testingRules = {
  "no-vitest-mocks": noVitestMocks,
  "no-test-skip-only": noTestSkipOnly,
  "no-coverage-threshold-gate": noCoverageThresholdGate,
  "no-hardcoded-assertion-literals": noHardcodedAssertionLiterals,
  "no-example-only-tests": noExampleOnlyTests,
} as const;
