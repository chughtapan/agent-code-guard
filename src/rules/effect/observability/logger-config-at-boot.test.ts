import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./logger-config-at-boot.js";

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

ruleTester.run("logger-config-at-boot", rule, {
  valid: [
    // Boot file: index.ts allows logger config
    {
      code: `Logger.withMinimumLogLevel(LogLevel.Debug);`,
      filename: "src/index.ts",
    },
    // Boot file: main.ts
    {
      code: `Logger.withMinimumLogLevel(LogLevel.Info);`,
      filename: "src/main.ts",
    },
    // Boot file: cli.ts
    {
      code: `Logger.withMinimumLogLevel(LogLevel.Info);`,
      filename: "packages/x/src/cli.ts",
    },
    // Boot file: under bin/
    {
      code: `Logger.withConsoleLog();`,
      filename: "bin/run.ts",
    },
    // Boot file: bootstrap.ts
    {
      code: `Logger.withMinimumLogLevel(LogLevel.Debug);`,
      filename: "src/bootstrap.ts",
    },
    // Non-Logger member call — not flagged
    {
      code: `Foo.withMinimumLogLevel(x);`,
      filename: "src/feature/work.ts",
    },
    // Logger.log (not config) — not flagged
    {
      code: `Logger.log("hi");`,
      filename: "src/feature/work.ts",
    },
  ],
  invalid: [
    // Business file with Logger.withMinimumLogLevel
    {
      code: `Logger.withMinimumLogLevel(LogLevel.Debug);`,
      filename: "src/feature/work.ts",
      errors: [
        {
          messageId: "loggerConfigAwayFromBoot",
          data: { method: "withMinimumLogLevel" },
        },
      ],
    },
    // Logger.withConsoleLog() in business code
    {
      code: `Logger.withConsoleLog();`,
      filename: "src/feature/work.ts",
      errors: [
        {
          messageId: "loggerConfigAwayFromBoot",
          data: { method: "withConsoleLog" },
        },
      ],
    },
    // Even more nested
    {
      code: `
        export const wrap = (program) =>
          program.pipe(Logger.withMinimumLogLevel(LogLevel.Debug));
      `,
      filename: "src/feature/wrap.ts",
      errors: [
        {
          messageId: "loggerConfigAwayFromBoot",
          data: { method: "withMinimumLogLevel" },
        },
      ],
    },
  ],
});
