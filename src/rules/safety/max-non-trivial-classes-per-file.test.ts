import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./max-non-trivial-classes-per-file.js";

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

ruleTester.run("max-non-trivial-classes-per-file", rule, {
  valid: [
    {
      filename: "/repo/src/errors.ts",
      code: `
        class FooError extends Data.TaggedError("FooError")<{ cause: string }> {}
        class BarError extends Data.TaggedError("BarError")<{ cause: string }> {}
        class BazError extends Data.TaggedError("BazError")<{ cause: string }> {}
      `,
    },
    {
      filename: "/repo/src/tags.ts",
      code: `
        class UserTag extends Context.Tag("User")<UserTag, UserService>() {}
        class DbTag extends Context.Tag("Db")<DbTag, DbService>() {}
        class CacheTag extends Context.Tag("Cache")<CacheTag, CacheService>() {}
      `,
    },
    {
      filename: "/repo/src/mixed.ts",
      code: `
        class FooError extends Data.TaggedError("FooError")<{}> {}
        class Real { run() { return 42; } }
      `,
    },
    {
      filename: "/repo/src/single.ts",
      code: `class Service { run() { return 1; } }`,
    },
    {
      filename: "/repo/src/two-allowed.ts",
      code: `
        class A { run() { return 1; } }
        class B { run() { return 2; } }
      `,
      options: [{ max: 2 }],
    },
  ],
  invalid: [
    {
      filename: "/repo/src/two-real.ts",
      code: `
        class A { run() { return 1; } }
        class B { run() { return 2; } }
      `,
      errors: [{ messageId: "tooMany" }],
    },
    {
      filename: "/repo/src/three-real-with-tags.ts",
      code: `
        class FooError extends Data.TaggedError("FooError")<{}> {}
        class A { run() { return 1; } }
        class B { run() { return 2; } }
        class C { run() { return 3; } }
      `,
      errors: [{ messageId: "tooMany" }, { messageId: "tooMany" }],
    },
  ],
});
