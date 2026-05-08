import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./no-env-nonnull-assert.js";

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

ruleTester.run("no-env-nonnull-assert", rule, {
  valid: [
    // Reading process.env without non-null assertion is fine
    { code: "const port = process.env.PORT;" },
    // Defaulting via ?? is the preferred pattern
    { code: "const port = process.env.PORT ?? '8080';" },
    // Defaulting via || is also fine
    { code: "const port = process.env.PORT || '8080';" },
    // Non-null assertion on a different object
    { code: "const x = obj.env.PORT!;" },
    // Non-null assertion on plain env (not process.env)
    { code: "const x = env.PORT!;" },
    // Suppression directive
    {
      code: "// eslint-disable-next-line @rule-tester/no-env-nonnull-assert -- suppression test\nconst port = process.env.PORT!;",
    },
  ],
  invalid: [
    // The basic shape
    {
      code: "const port = process.env.PORT!;",
      errors: [{ messageId: "envNonNullAssert" }],
    },
    // In an expression
    {
      code: "doSomething(process.env.DATABASE_URL!);",
      errors: [{ messageId: "envNonNullAssert" }],
    },
    // As a function argument with template
    {
      code: "throw new Error(`port=${process.env.PORT!}`);",
      errors: [{ messageId: "envNonNullAssert" }],
    },
    // Multiple assertions in one file
    {
      code: "const a = process.env.A!; const b = process.env.B!;",
      errors: [
        { messageId: "envNonNullAssert" },
        { messageId: "envNonNullAssert" },
      ],
    },
  ],
});
