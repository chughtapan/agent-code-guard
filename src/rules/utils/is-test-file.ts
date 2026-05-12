/**
 * @file Shared test-file predicate. Path-shaped check used by
 * testing/safety rules to gate which files participate in test-only
 * exemptions.
 */

const TEST_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /[\\/]tests?[\\/]/,
  /[\\/]__tests__[\\/]/,
  /[\\/]test-support[\\/]/,
  /[\\/]fixtures?[\\/]/,
  /[\\/]__fixtures__[\\/]/,
  /[\\/]e2e[\\/]/,
];

/**
 * Whether `filename` matches one of the recognized test file shapes
 * (`.test.ts`, `.spec.ts`, `__tests__/`, `test-support/`, `fixtures/`,
 * `e2e/`, etc.).
 * @param filename Path to inspect.
 * @returns `true` if the path looks like a test, fixture, or
 * test-support module.
 */
export function isTestFile(filename: string): boolean {
  return TEST_FILE_PATTERNS.some((p) => p.test(filename));
}
