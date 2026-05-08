import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./prefer-decode-effect-at-boundary.js";

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

ruleTester.run("prefer-decode-effect-at-boundary", rule, {
  valid: [
    // Effect-returning decoder over JSON.parse — preferred
    {
      code: "const program = Schema.decodeUnknown(S)(JSON.parse(input));",
    },
    // Sync decoder over an in-memory object (no I/O) — fine
    {
      code: "const u = Schema.decodeUnknownSync(S)(known);",
    },
    // decodeUnknownSync where argument is a literal — fine
    {
      code: "const u = Schema.decodeUnknownSync(S)({ id: '1' });",
    },
    // decodeUnknownSync called without immediate application — fine (curried use)
    {
      code: "const decoder = Schema.decodeUnknownSync(S);",
    },
  ],
  invalid: [
    // The classic case: Schema.decodeUnknownSync(S)(JSON.parse(...))
    {
      code: "const u = Schema.decodeUnknownSync(S)(JSON.parse(input));",
      errors: [
        {
          messageId: "syncDecodeAtBoundary",
          data: { method: "decodeUnknownSync", source: "JSON.parse" },
        },
      ],
    },
    // decodeSync also flagged
    {
      code: "const u = Schema.decodeSync(S)(JSON.parse(input));",
      errors: [
        {
          messageId: "syncDecodeAtBoundary",
          data: { method: "decodeSync", source: "JSON.parse" },
        },
      ],
    },
    // After fs.readFileSync
    {
      code: "const u = Schema.decodeUnknownSync(S)(fs.readFileSync('a.json'));",
      errors: [
        {
          messageId: "syncDecodeAtBoundary",
          data: { method: "decodeUnknownSync", source: "an I/O call (fs.read*, fetch, etc.)" },
        },
      ],
    },
    // After await fetch
    {
      code: "const u = Schema.decodeUnknownSync(S)(await fetch('/a'));",
      errors: [
        {
          messageId: "syncDecodeAtBoundary",
          data: { method: "decodeUnknownSync", source: "an I/O call (fs.read*, fetch, etc.)" },
        },
      ],
    },
    // decodeUnknownEither also flagged when sync over I/O
    {
      code: "const u = Schema.decodeUnknownEither(S)(JSON.parse(input));",
      errors: [
        {
          messageId: "syncDecodeAtBoundary",
          data: { method: "decodeUnknownEither", source: "JSON.parse" },
        },
      ],
    },
  ],
});
