import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./require-span-on-exported-effect.js";

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

ruleTester.run("require-span-on-exported-effect", rule, {
  valid: [
    // Effect.gen with Effect.withSpan in the body — fine
    {
      code: `
        export const program = Effect.gen(function* () {
          yield* Effect.withSpan("program")(load);
        });
      `,
    },
    // Effect.gen piped through withSpan — fine
    {
      code: `
        export const program = Effect.gen(function* () {
          return yield* load;
        }).pipe(Effect.withSpan("program"));
      `,
    },
    // Non-exported Effect.gen — not in scope of the rule
    {
      code: `
        const program = Effect.gen(function* () {
          return yield* load;
        });
      `,
    },
    // Exported value that isn't an Effect.gen — not in scope
    {
      code: `export const port = 8080;`,
    },
    // Function export with withSpan inside
    {
      code: `
        export function program() {
          return Effect.gen(function* () {
            yield* Effect.withSpan("program")(load);
          });
        }
      `,
    },
  ],
  invalid: [
    // Exported Effect.gen with no withSpan
    {
      code: `
        export const program = Effect.gen(function* () {
          return yield* load;
        });
      `,
      errors: [{ messageId: "missingSpan", data: { name: "program" } }],
    },
    // Exported function returning Effect.gen, no withSpan
    {
      code: `
        export function program() {
          return Effect.gen(function* () {
            return yield* load;
          });
        }
      `,
      errors: [{ messageId: "missingSpan", data: { name: "program" } }],
    },
    // Exported Effect.gen.pipe(...) that lacks withSpan
    {
      code: `
        export const program = Effect.gen(function* () {
          return yield* load;
        }).pipe(Effect.tap(log));
      `,
      errors: [{ messageId: "missingSpan", data: { name: "program" } }],
    },
  ],
});
