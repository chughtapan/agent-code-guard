import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./parse-into-schema-requires-effect.js";

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

ruleTester.run("parse-into-schema-requires-effect", rule, {
  valid: [
    // JSON.parse inside Effect.try
    {
      code: `
        const program = Effect.try(() => Schema.decodeUnknownSync(S)(JSON.parse(input)));
      `,
    },
    // JSON.parse inside Effect.tryPromise
    {
      code: `
        const program = Effect.tryPromise(() => Schema.decodeUnknownSync(S)(JSON.parse(input)));
      `,
    },
    // Argument is not JSON.parse
    {
      code: `const u = Schema.decodeUnknownSync(S)(input);`,
    },
    // Decoder is not Schema.*
    {
      code: `const u = OtherSchema.decode(S)(JSON.parse(input));`,
    },
  ],
  invalid: [
    // Sync decoder + JSON.parse not wrapped in Effect.try
    {
      code: `const u = Schema.decodeUnknownSync(S)(JSON.parse(input));`,
      errors: [
        {
          messageId: "parseNeedsEffectTry",
          data: { decoder: "decodeUnknownSync" },
        },
      ],
    },
    // Effect-returning decoder over raw JSON.parse — still flagged because the parse can throw outside the Effect
    {
      code: `const program = Schema.decodeUnknown(S)(JSON.parse(input));`,
      errors: [
        {
          messageId: "parseNeedsEffectTry",
          data: { decoder: "decodeUnknown" },
        },
      ],
    },
    // Either-returning decoder, parse not wrapped
    {
      code: `const e = Schema.decodeUnknownEither(S)(JSON.parse(input));`,
      errors: [
        {
          messageId: "parseNeedsEffectTry",
          data: { decoder: "decodeUnknownEither" },
        },
      ],
    },
  ],
});
