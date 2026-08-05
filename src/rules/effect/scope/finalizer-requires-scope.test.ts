/**
 * @file Verifies Scope finalizers reside beneath Effect.scoped or Layer.scoped rather than bare expressions and generators.
 */

import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { finalizerRequiresScope as rule } from "./finalizer-requires-scope.js";

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

ruleTester.run("finalizer-requires-scope", rule, {
  valid: [
    {
      code: `
        const program = Effect.scoped(Effect.gen(function* () {
          yield* Scope.addFinalizer(close);
        }));
      `,
    },
    {
      code: `
        const layer = Layer.scoped(MyTag, Effect.gen(function* () {
          yield* Scope.addFinalizer(close);
        }));
      `,
    },
    {
      code: `Effect.succeed(1);`,
    },
  ],
  invalid: [
    {
      code: `Scope.addFinalizer(close);`,
      errors: [{ messageId: "finalizerWithoutScope" }],
    },
    {
      code: `
        function* run() {
          yield* Scope.addFinalizer(close);
        }
      `,
      errors: [{ messageId: "finalizerWithoutScope" }],
    },
  ],
});
