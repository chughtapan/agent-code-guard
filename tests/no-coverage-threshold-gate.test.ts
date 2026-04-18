import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-coverage-threshold-gate.js";

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

ruleTester.run("no-coverage-threshold-gate", rule, {
  valid: [
    {
      filename: "/repo/vitest.config.ts",
      code: "export default { test: { coverage: { reporter: ['text'] } } };",
    },
    {
      filename: "/repo/jest.config.js",
      code: "module.exports = { collectCoverage: true };",
    },
    {
      filename: "/repo/src/app.ts",
      code: "const cfg = { coverageThreshold: { global: { lines: 80 } } };",
    },
    {
      filename: "/repo/src/app.ts",
      code: "const cfg = { coverage: { thresholds: { lines: 80 } } };",
    },
    {
      filename: "/repo/vitest.config.ts",
      code: "// eslint-disable-next-line @rule-tester/no-coverage-threshold-gate -- suppression test\nexport default { test: { coverage: { thresholds: { lines: 80 } } } };",
    },
  ],
  invalid: [
    {
      filename: "/repo/jest.config.js",
      code: "module.exports = { coverageThreshold: { global: { lines: 80 } } };",
      errors: [{ messageId: "coverageGate", data: { key: "coverageThreshold" } }],
    },
    {
      filename: "/repo/jest.config.ts",
      code: "export default { coverageThreshold: { global: { statements: 90 } } };",
      errors: [{ messageId: "coverageGate", data: { key: "coverageThreshold" } }],
    },
    {
      filename: "/repo/vitest.config.ts",
      code: "export default { test: { coverage: { thresholds: { lines: 80 } } } };",
      errors: [{ messageId: "coverageGate", data: { key: "thresholds" } }],
    },
    {
      filename: "/repo/vite.config.ts",
      code: "export default { test: { coverage: { threshold: { lines: 80 } } } };",
      errors: [{ messageId: "coverageGate", data: { key: "threshold" } }],
    },
    {
      filename: "/repo/vitest.config.mts",
      code: "export default { test: { coverage: { thresholds: { branches: 70, lines: 80 } } } };",
      errors: [{ messageId: "coverageGate", data: { key: "thresholds" } }],
    },
  ],
});
