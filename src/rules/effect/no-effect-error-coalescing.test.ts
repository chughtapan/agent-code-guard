import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./no-effect-error-coalescing.js";

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
            MissingUser: (err) => Effect.fail(err),
            MissingOrg: (err) => Effect.fail(err),
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
