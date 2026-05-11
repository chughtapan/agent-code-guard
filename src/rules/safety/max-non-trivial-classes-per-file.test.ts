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
      filename: "/repo/src/tag-with-body.ts",
      // Tag classes with methods or static fields are still tag classes —
      // the factory is what matters, not whether the body is empty.
      code: `
        class FooError extends Data.TaggedError("FooError")<{ cause: string }> {
          override toString() { return this._tag + ": " + this.cause; }
        }
        class BarError extends Data.TaggedError("BarError")<{ cause: string }> {
          static layer = "layer-placeholder";
        }
      `,
    },
    {
      filename: "/repo/src/effect-service.ts",
      code: `
        class UserService extends Effect.Service<UserService>()("UserService", {
          succeed: { run: () => null },
        }) {}
        class DbService extends Effect.Service<DbService>()("DbService", {
          succeed: { run: () => null },
        }) {}
      `,
    },
    {
      filename: "/repo/src/schema-classes.ts",
      code: `
        class User extends Schema.Class<User>("User")({ id: Schema.String, name: Schema.String }) {}
        class Address extends Schema.Class<Address>("Address")({ street: Schema.String }) {}
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
    {
      filename: "/repo/src/custom-factories.ts",
      // User-configured factories from a non-Effect framework — all three
      // classes extend a configured factory, so they're exempt.
      code: `
        class A extends MyLib.TaggedThing("A")<{}> {}
        class B extends MyLib.TaggedThing("B")<{}> {}
        class C extends MyLib.TaggedThing("C")<{}> {}
      `,
      options: [{ factories: ["MyLib.TaggedThing"] }],
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
    {
      filename: "/repo/src/empty-markers.ts",
      // Empty bodies are no longer free — only tag-factory subclasses are.
      // Two empty marker classes with no Effect superclass still count.
      code: `
        class Marker1 {}
        class Marker2 {}
      `,
      errors: [{ messageId: "tooMany" }],
    },
    {
      filename: "/repo/src/decorated-empty.ts",
      // A decorated empty class carries behavior through the decorator and
      // is NOT an Effect tag class — should count.
      code: `
        @Injectable() class A {}
        @Injectable() class B {}
      `,
      errors: [{ messageId: "tooMany" }],
    },
    {
      filename: "/repo/src/non-effect-superclass.ts",
      // Extending a non-Effect base is not tag-factory exempt.
      code: `
        class A extends BaseService {}
        class B extends BaseService {}
      `,
      errors: [{ messageId: "tooMany" }],
    },
    {
      filename: "/repo/src/custom-factories-override.ts",
      // Configuring `factories` overrides the default — Effect's
      // Data.TaggedError is no longer exempt when the user supplies a
      // smaller list.
      code: `
        class FooError extends Data.TaggedError("FooError")<{}> {}
        class BarError extends Data.TaggedError("BarError")<{}> {}
      `,
      options: [{ factories: ["MyLib.OnlyThis"] }],
      errors: [{ messageId: "tooMany" }],
    },
  ],
});
