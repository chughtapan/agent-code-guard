/**
 * @file Validates that map and catch handlers cannot collapse errors into fresh wrappers, except for tag-specific or identity paths.
 */

import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import * as fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { lintRule } from "../../test-support/property-lint.js";
import { noEffectErrorCoalescing as rule } from "./no-effect-error-coalescing.js";

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

ruleTester.run("no-effect-error-coalescing", rule, {
  valid: [
    {
      code: `
        const run = program.pipe(
          Effect.catchTag("MissingUser", (err) => Effect.fail(err)),
        );
      `,
    },
    {
      code: `
        const run = program.pipe(
          Effect.catchTags({
            "MissingUser": (err) => Effect.fail(err),
            "MissingOrg": (err) => Effect.fail(err),
          }),
        );
      `,
    },
    {
      code: "const run = program.pipe(Effect.mapError((err) => err));",
    },
    {
      code: "const run = program.pipe(Effect.catchAll((err) => Effect.fail(err)));",
    },
  ],
  invalid: [
    {
      code: `
        const run = Effect.all([readUser, readOrg]).pipe(
          Effect.mapError((cause) => new LoadError({ cause })),
        );
      `,
      errors: [
        {
          messageId: "effectErrorCoalescing",
          data: { name: "LoadError" },
        },
      ],
    },
    {
      code: `
        const run = Effect.gen(function* () {
          const user = yield* readUser;
          const org = yield* readOrg;
          return { user, org };
        }).pipe(Effect.mapError((cause) => new LoadError({ cause })));
      `,
      errors: [
        {
          messageId: "effectErrorCoalescing",
          data: { name: "LoadError" },
        },
      ],
    },
    {
      code: "const run = program.pipe(Effect.mapError(() => new LoadError()));",
      errors: [
        {
          messageId: "effectErrorCoalescing",
          data: { name: "LoadError" },
        },
      ],
    },
    {
      code: `
        const run = program.pipe(
          Effect.catchAll((cause) => Effect.fail(new LoadError({ cause }))),
        );
      `,
      errors: [
        {
          messageId: "effectErrorCoalescing",
          data: { name: "LoadError" },
        },
      ],
    },
    {
      code: `
        const run = program.pipe(
          Effect.catchAllCause((cause) => Effect.fail(new LoadDefect({ cause }))),
        );
      `,
      errors: [
        {
          messageId: "effectErrorCoalescing",
          data: { name: "LoadDefect" },
        },
      ],
    },
  ],
});

const typeNameArb = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);

describe("property: Effect error coalescing", () => {
  it("Effect error coalescing fires across broad error handlers", () => {
    fc.assert(
      fc.property(typeNameArb, fc.constantFrom("mapError", "catchAll", "catchAllCause"), (name, method) => {
        const errorName = `${name}Error`;
        const body =
          method === "mapError" ? `new ${errorName}({ cause })` : `Effect.fail(new ${errorName}({ cause }))`;
        const code = `const run = program.pipe(Effect.${method}((cause) => ${body}));`;
        expect(lintRule(code, "agent-code-guard/no-effect-error-coalescing")).toHaveLength(1);
      }),
      { numRuns: 60 },
    );
  });

  it("Effect error handlers that preserve the incoming error stay clean", () => {
    fc.assert(
      fc.property(fc.constantFrom("mapError", "catchAll", "catchAllCause"), (method) => {
        const body = method === "mapError" ? "err" : "Effect.fail(err)";
        const code = `const run = program.pipe(Effect.${method}((err) => ${body}));`;
        expect(lintRule(code, "agent-code-guard/no-effect-error-coalescing")).toHaveLength(0);
      }),
      { numRuns: 30 },
    );
  });
});
