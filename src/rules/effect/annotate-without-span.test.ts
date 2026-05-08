import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./annotate-without-span.js";

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

ruleTester.run("annotate-without-span", rule, {
  valid: [
    // annotateCurrentSpan with withSpan in the same file — fine
    {
      code: `
        const program = Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan({ user: id });
          yield* doWork;
        }).pipe(Effect.withSpan("program"));
      `,
    },
    // No annotateCurrentSpan — rule has nothing to flag
    {
      code: `Effect.log("hi");`,
    },
    // annotateCurrentSpan inside an Effect.withSpan call argument
    {
      code: `
        Effect.withSpan("op")(Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan({ user: id });
        }));
      `,
    },
    // withSpan via destructured import
    {
      code: `
        import { withSpan } from "effect/Effect";
        function* run() {
          yield* Effect.annotateCurrentSpan({ x: 1 });
          yield* withSpan("op")(work);
        }
      `,
    },
  ],
  invalid: [
    // annotateCurrentSpan with no withSpan anywhere
    {
      code: `Effect.annotateCurrentSpan({ x: 1 });`,
      errors: [{ messageId: "annotateWithoutSpan" }],
    },
    // Multiple annotates, no withSpan
    {
      code: `
        function* run() {
          yield* Effect.annotateCurrentSpan({ a: 1 });
          yield* Effect.annotateCurrentSpan({ b: 2 });
        }
      `,
      errors: [
        { messageId: "annotateWithoutSpan" },
        { messageId: "annotateWithoutSpan" },
      ],
    },
    // annotateCurrentSpan inside an Effect.gen but file has no withSpan
    {
      code: `
        const program = Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan({ user: id });
        });
      `,
      errors: [{ messageId: "annotateWithoutSpan" }],
    },
  ],
});
