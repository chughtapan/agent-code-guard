import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./prefer-annotate-logs.js";

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

ruleTester.run("prefer-annotate-logs", rule, {
  valid: [
    // Single-arg log — fine
    { code: `Effect.log("hello");` },
    // Second arg is an identifier (already annotated context, not inline)
    { code: `Effect.log("hello", ctx);` },
    // Second arg is a function call result
    { code: `Effect.log("hello", buildContext());` },
    // Non-Effect.log call
    { code: `Logger.log("hi", { foo: 1 });` },
    // Effect method that's not a log
    { code: `Effect.tap((x) => x);` },
  ],
  invalid: [
    // Effect.log with inline context object
    {
      code: `Effect.log("loaded user", { userId: id });`,
      errors: [{ messageId: "preferAnnotateLogs", data: { method: "log" } }],
    },
    // Effect.logDebug with inline context
    {
      code: `Effect.logDebug("trace", { step: 1, total: 5 });`,
      errors: [{ messageId: "preferAnnotateLogs", data: { method: "logDebug" } }],
    },
    // Effect.logError
    {
      code: `Effect.logError("failed", { reason: "timeout" });`,
      errors: [{ messageId: "preferAnnotateLogs", data: { method: "logError" } }],
    },
  ],
});
