import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./fork-requires-lifecycle.js";

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

ruleTester.run("fork-requires-lifecycle", rule, {
  valid: [
    // Fork captured to a const — lifecycle is the caller's responsibility
    {
      code: `
        const program = function* () {
          const fiber = yield* Effect.fork(work);
          yield* Fiber.await(fiber);
        };
      `,
    },
    // forkScoped is fine (built-in lifecycle)
    {
      code: `
        function* run() {
          yield* Effect.forkScoped(work);
        }
      `,
    },
    // forkDaemon is fine (long-lived intentionally)
    {
      code: `
        function* run() {
          yield* Effect.forkDaemon(work);
        }
      `,
    },
    // Fork as part of a larger expression (assigned via destructuring)
    {
      code: `
        async function run() {
          const [, fiber] = await Promise.all([prep(), Effect.runPromise(Effect.fork(work))]);
        }
      `,
    },
  ],
  invalid: [
    // yield* Effect.fork(...) at statement position — fiber leaks
    {
      code: `
        function* run() {
          yield* Effect.fork(work);
        }
      `,
      errors: [{ messageId: "forkResultDiscarded", data: { method: "fork" } }],
    },
    // Bare Effect.fork(...); — also discarded
    {
      code: "Effect.fork(work);",
      errors: [{ messageId: "forkResultDiscarded", data: { method: "fork" } }],
    },
    // await Effect.fork(...) at statement position
    {
      code: `
        async function run() {
          await Effect.runPromise(Effect.fork(work));
          await Effect.fork(work);
        }
      `,
      errors: [{ messageId: "forkResultDiscarded", data: { method: "fork" } }],
    },
  ],
});
