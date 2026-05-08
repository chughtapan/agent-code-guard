import { createTypedRuleTester } from "../../../utils/typed-rule-tester.js";
import rule from "./runpromise-requires-scoped.js";

const ruleTester = createTypedRuleTester();

const filename = "src/utils/test-support/typed-fixture.ts";

ruleTester.run("runpromise-requires-scoped", rule, {
  valid: [
    {
      // Effect with no Scope requirement — fine
      code: `
        type Effect<A, E = never, R = never> = { _A: A; _E: E; _R: R };
        const Effect = {
          runPromise: <A, E>(_e: Effect<A, E, never>): Promise<A> => Promise.resolve({} as A),
          succeed: <A>(_a: A): Effect<A, never, never> => ({} as Effect<A, never, never>),
        };
        const program: Effect<number, never, never> = Effect.succeed(1);
        const result = Effect.runPromise(program);
      `,
      filename,
    },
    {
      // Unrelated call — not flagged
      code: `const x = Math.random();`,
      filename,
    },
    {
      // Effect.runSync without Scope — also not flagged
      code: `
        type Effect<A, E = never, R = never> = { _A: A; _E: E; _R: R };
        const Effect = {
          runSync: <A, E>(_e: Effect<A, E, never>): A => ({} as A),
        };
        declare const program: Effect<number, never, never>;
        Effect.runSync(program);
      `,
      filename,
    },
  ],
  invalid: [
    {
      // Effect.runPromise on Effect requiring Scope — fires
      code: `
        type Scope = { _tag: "Scope" };
        type Effect<A, E = never, R = never> = { _A: A; _E: E; _R: R };
        const Effect = {
          runPromise: <A, E, R>(_e: Effect<A, E, R>): Promise<A> => Promise.resolve({} as A),
        };
        declare const program: Effect<number, never, Scope>;
        const result = Effect.runPromise(program);
      `,
      filename,
      errors: [{ messageId: "runRequiresScope", data: { runner: "runPromise" } }],
    },
    {
      // Effect.runSync also fires when input requires Scope
      code: `
        type Scope = { _tag: "Scope" };
        type Effect<A, E = never, R = never> = { _A: A; _E: E; _R: R };
        const Effect = {
          runSync: <A, E, R>(_e: Effect<A, E, R>): A => ({} as A),
        };
        declare const program: Effect<number, never, Scope>;
        Effect.runSync(program);
      `,
      filename,
      errors: [{ messageId: "runRequiresScope", data: { runner: "runSync" } }],
    },
    {
      // runPromiseExit also fires
      code: `
        type Scope = { _tag: "Scope" };
        type Effect<A, E = never, R = never> = { _A: A; _E: E; _R: R };
        const Effect = {
          runPromiseExit: <A, E, R>(_e: Effect<A, E, R>): Promise<A> => Promise.resolve({} as A),
        };
        declare const program: Effect<number, never, Scope>;
        Effect.runPromiseExit(program);
      `,
      filename,
      errors: [{ messageId: "runRequiresScope", data: { runner: "runPromiseExit" } }],
    },
  ],
});
