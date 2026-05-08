import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./effect-foreach-requires-concurrency.js";

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

ruleTester.run("effect-foreach-requires-concurrency", rule, {
  valid: [
    // Explicit numeric concurrency
    { code: `Effect.forEach(items, fn, { concurrency: 5 });` },
    // "unbounded" still counts as explicit (caught by no-unbounded-concurrency separately)
    { code: `Effect.forEach(items, fn, { concurrency: "unbounded" });` },
    // "inherit"
    { code: `Effect.forEach(items, fn, { concurrency: "inherit" });` },
    // String literal key
    { code: `Effect.forEach(items, fn, { "concurrency": 3 });` },
    // Other Effect methods unrelated
    { code: `Effect.map(items, fn);` },
    // Non-Effect.forEach
    { code: `Array.from(items).forEach(fn);` },
  ],
  invalid: [
    // Two-arg form: no options at all
    {
      code: `Effect.forEach(items, fn);`,
      errors: [{ messageId: "missingConcurrency" }],
    },
    // Options present but no concurrency key
    {
      code: `Effect.forEach(items, fn, { discard: true });`,
      errors: [{ messageId: "missingConcurrency" }],
    },
    // Options has unrelated key
    {
      code: `Effect.forEach(items, fn, { batching: true });`,
      errors: [{ messageId: "missingConcurrency" }],
    },
  ],
});
