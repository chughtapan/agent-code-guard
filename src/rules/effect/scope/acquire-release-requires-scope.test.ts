/**
 * @file Detects acquire-release resource constructors outside Effect.scoped or Layer.scoped, including repeated acquisition sites.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { acquireReleaseRequiresScope as rule } from "./acquire-release-requires-scope.js";
import * as tsParser from "@typescript-eslint/parser";

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

ruleTester.run("acquire-release-requires-scope", rule, {
  valid: [
    {
      code: `
        const program = Effect.acquireRelease(open, close);
        const scoped = Effect.scoped(program);
      `,
    },
    {
      code: `
        const layer = Layer.scoped(MyTag, Effect.acquireRelease(open, close));
      `,
    },
    {
      code: `Effect.succeed(1);`,
    },
  ],
  invalid: [
    {
      code: `const program = Effect.acquireRelease(open, close);`,
      errors: [{ messageId: "acquireWithoutScope", data: { method: "acquireRelease" } }],
    },
    {
      code: `const program = Effect.acquireUseRelease(open, use, close);`,
      errors: [{ messageId: "acquireWithoutScope", data: { method: "acquireUseRelease" } }],
    },
    {
      code: `
        const a = Effect.acquireRelease(openA, closeA);
        const b = Effect.acquireRelease(openB, closeB);
      `,
      errors: [
        { messageId: "acquireWithoutScope", data: { method: "acquireRelease" } },
        { messageId: "acquireWithoutScope", data: { method: "acquireRelease" } },
      ],
    },
  ],
});
