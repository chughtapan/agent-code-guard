import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/no-unbounded-concurrency.js";

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

ruleTester.run("no-unbounded-concurrency", rule, {
  valid: [
    {
      code: "yield* Effect.all(tasks);",
    },
    {
      code: "yield* Effect.all(tasks, { concurrency: 4 });",
    },
    {
      code: "yield* Effect.forEach(tasks, runTask, { concurrency: limit });",
    },
    {
      code: "yield* Task.all(tasks, { concurrency: 'unbounded' });",
    },
    {
      code: "yield* Effect.log('fanout', { concurrency: 'unbounded' });",
    },
    {
      code: "// eslint-disable-next-line @rule-tester/no-unbounded-concurrency -- suppression test\nyield* Effect.all(tasks, { concurrency: 'unbounded' });",
    },
  ],
  invalid: [
    {
      code: "yield* Effect.all(tasks, { concurrency: 'unbounded' });",
      errors: [{ messageId: "noUnboundedConcurrency", data: { method: "all" } }],
    },
    {
      code: "yield* Effect.forEach(tasks, runTask, { concurrency: 'unbounded' });",
      errors: [{ messageId: "noUnboundedConcurrency", data: { method: "forEach" } }],
    },
    {
      code: "yield* Effect.all(tasks, { mode: 'either', concurrency: 'unbounded' });",
      errors: [{ messageId: "noUnboundedConcurrency", data: { method: "all" } }],
    },
    {
      code: "yield* Effect.validateAll(tasks, { ['concurrency']: `unbounded` });",
      errors: [{ messageId: "noUnboundedConcurrency", data: { method: "validateAll" } }],
    },
  ],
});
