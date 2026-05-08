import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./no-promise-all-in-effect.js";

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

ruleTester.run("no-promise-all-in-effect", rule, {
  valid: [
    // No effect import: Promise.all is fine
    {
      code: `
        import axios from "axios";
        const results = await Promise.all([axios.get("/a"), axios.get("/b")]);
      `,
    },
    // Effect imported but no Promise.all
    {
      code: `
        import { Effect } from "effect";
        const program = Effect.all([Effect.succeed(1), Effect.succeed(2)], { concurrency: 2 });
      `,
    },
    // Promise.resolve is allowed (not in our list)
    {
      code: `
        import { Effect } from "effect";
        const ready = Promise.resolve(1);
      `,
    },
    // Promise.reject is allowed
    {
      code: `
        import { Effect } from "effect";
        const failed = Promise.reject(new Error("nope"));
      `,
    },
  ],
  invalid: [
    // The basic case
    {
      code: `
        import { Effect } from "effect";
        const results = await Promise.all([fetch("/a"), fetch("/b")]);
      `,
      errors: [{ messageId: "promiseStaticInEffect", data: { name: "all" } }],
    },
    // Promise.allSettled
    {
      code: `
        import { Effect } from "effect";
        await Promise.allSettled(tasks);
      `,
      errors: [{ messageId: "promiseStaticInEffect", data: { name: "allSettled" } }],
    },
    // Promise.race
    {
      code: `
        import { Effect } from "effect";
        const winner = await Promise.race([slow(), fast()]);
      `,
      errors: [{ messageId: "promiseStaticInEffect", data: { name: "race" } }],
    },
    // Promise.any
    {
      code: `
        import { Effect } from "effect";
        const first = await Promise.any([a(), b(), c()]);
      `,
      errors: [{ messageId: "promiseStaticInEffect", data: { name: "any" } }],
    },
    // @effect/platform import also triggers
    {
      code: `
        import { FileSystem } from "@effect/platform";
        await Promise.all([fs.read("/a"), fs.read("/b")]);
      `,
      errors: [{ messageId: "promiseStaticInEffect", data: { name: "all" } }],
    },
  ],
});
