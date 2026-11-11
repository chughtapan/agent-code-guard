/**
 * @file Confirms exported Effect values carry a span and exported functions that only wrap a generator become `Effect.fn`, unlike private programs.
 */

import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { requireSpanOnExportedEffect as rule } from "./require-span-on-exported-effect.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
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
    // Effect.fn names its own span
    {
      code: `
        export const program = Effect.fn("program")(function* (id: string) {
          return yield* load(id);
        });
      `,
    },
    // Statements before the return keep the function as written
    {
      code: `
        export function program(id: string) {
          const key = normalize(id);
          return Effect.gen(function* () {
            return yield* load(key);
          }).pipe(Effect.withSpan("program"));
        }
      `,
    },
    // Span options stay on withSpan
    {
      code: `
        export const program = (id: string) =>
          Effect.gen(function* () {
            return yield* load(id);
          }).pipe(Effect.withSpan("program", { attributes: { id } }));
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
    // Exported function returning a bare Effect.gen
    {
      code: `
        export function program() {
          return Effect.gen(function* () {
            return yield* load;
          });
        }
      `,
      output: `
        export const program = Effect.fn("program")(function* () {
            return yield* load;
          });
      `,
      errors: [{ messageId: "preferFn", data: { name: "program", spanName: "program" } }],
    },
    // The span name already in use is kept, with type parameters and parameters
    {
      code: `
        export function program<A>(id: string, fallback?: A) {
          return Effect.gen(function* () {
            return yield* load(id, fallback);
          }).pipe(Effect.withSpan("users.program"));
        }
      `,
      output: `
        export const program = Effect.fn("users.program")(function* <A>(id: string, fallback?: A) {
            return yield* load(id, fallback);
          });
      `,
      errors: [{ messageId: "preferFn", data: { name: "program", spanName: "users.program" } }],
    },
    // Arrow function with an expression body
    {
      code: `
        export const program = (id: string) =>
          Effect.gen(function* () {
            return yield* load(id);
          }).pipe(Effect.withSpan("program"));
      `,
      output: `
        export const program = Effect.fn("program")(function* (id: string) {
            return yield* load(id);
          });
      `,
      errors: [{ messageId: "preferFn", data: { name: "program", spanName: "program" } }],
    },
    // Other pipe steps move into Effect.fn by hand, since they may read the parameters
    {
      code: `
        export function program(id: string) {
          return Effect.gen(function* () {
            return yield* load(id);
          }).pipe(scopedTo(id), Effect.withSpan("program"));
        }
      `,
      output: null,
      errors: [{ messageId: "preferFn", data: { name: "program", spanName: "program" } }],
    },
    // A declared return type has no place on the generator, so the rewrite is by hand
    {
      code: `
        export function program(id: string): Effect.Effect<User> {
          return Effect.gen(function* () {
            return yield* load(id);
          }).pipe(Effect.withSpan("program"));
        }
      `,
      output: null,
      errors: [{ messageId: "preferFn", data: { name: "program", spanName: "program" } }],
    },
    // A pipeline with no generator takes Effect.fn as a plain function
    {
      code: `
        export const program = (id: string) =>
          load(id).pipe(Effect.map(decode), Effect.withSpan("users.program"));
      `,
      output: null,
      errors: [{ messageId: "preferFn", data: { name: "program", spanName: "users.program" } }],
    },
    // A function that pipes other steps and has no span still needs one
    {
      code: `
        export function program(id: string) {
          return Effect.gen(function* () {
            return yield* load(id);
          }).pipe(scopedTo(id));
        }
      `,
      output: null,
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
