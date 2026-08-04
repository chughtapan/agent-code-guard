export default {
  mutate: [
    "src/rules/vertical-organization/jsdoc-attachments.ts",
    "src/rules/vertical-organization/jsdoc-fragments.ts",
    "src/rules/vertical-organization/no-vacuous-jsdoc.ts",
    "src/rules/vertical-organization/prefer-stepdown-function-order.ts",
    "src/rules/vertical-organization/require-stable-file-shell.ts",
    "src/rules/vertical-organization/side-effect-import-barriers.ts",
    "src/rules/vertical-organization/stepdown-graph.ts",
    "src/rules/vertical-organization/stepdown-implementations.ts",
    "src/rules/vertical-organization/stepdown-scc.ts",
    // `stepdown-model.ts` is type-only and emits no runtime mutation candidates.
  ],
  // Keep this gate focused on the direct, rule-level specifications.  Without
  // `testFiles`, Vitest's related-test discovery traverses the entire project
  // before the dry run, despite this deliberately narrow mutation scope.
  testFiles: [
    "src/rules/vertical-organization/jsdoc-attachments.test.ts",
    "src/rules/vertical-organization/jsdoc-fragments.dynamic.test.ts",
    "src/rules/vertical-organization/jsdoc-fragments.test.ts",
    "src/rules/vertical-organization/no-vacuous-jsdoc.test.ts",
    "src/rules/vertical-organization/prefer-stepdown-function-order.class.test.ts",
    "src/rules/vertical-organization/prefer-stepdown-function-order.graph.test.ts",
    "src/rules/vertical-organization/prefer-stepdown-function-order.meta.test.ts",
    "src/rules/vertical-organization/prefer-stepdown-function-order.test.ts",
    "src/rules/vertical-organization/require-stable-file-shell.test.ts",
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
  // `testFiles` is the explicit dependency boundary for this gate, so related
  // discovery is redundant and can only broaden the dry run.
  vitest: { related: false },
  incremental: false,
};
