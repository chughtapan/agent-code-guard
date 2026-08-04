export default {
  mutate: [
    "src/rules/vertical-organization/no-vacuous-jsdoc.ts",
    "src/rules/vertical-organization/require-stable-file-shell.ts",
    "src/rules/vertical-organization/prefer-stepdown-function-order.ts",
  ],
  testRunner: "vitest",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  plugins: ["@stryker-mutator/vitest-runner", "@stryker-mutator/typescript-checker"],
  thresholds: { high: 100, low: 100, break: 100 },
  reporters: ["clear-text", "html", "json"],
  htmlReporter: {
    fileName: "reports/mutation/vertical-organization/index.html",
  },
  jsonReporter: {
    fileName: "reports/mutation/vertical-organization/mutation.json",
  },
  incremental: false,
};
