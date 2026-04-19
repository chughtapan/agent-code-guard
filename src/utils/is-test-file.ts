const TEST_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /[\\/]tests?[\\/]/,
  /[\\/]__tests__[\\/]/,
  /[\\/]e2e[\\/]/,
];

export function isTestFile(filename: string): boolean {
  return TEST_FILE_PATTERNS.some((p) => p.test(filename));
}
