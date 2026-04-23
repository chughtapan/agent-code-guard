import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/manual-result.js";

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

ruleTester.run("manual-result", rule, {
  valid: [
    {
      code: "type UserResponse = { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: string };",
    },
    {
      code: 'type SessionState = { readonly _tag: "Left"; readonly message: string } | { readonly _tag: "Right"; readonly value: string };',
    },
    {
      code: 'const outcome = { ok: true as const, value };',
    },
    {
      code: "const status = { ok: () => true, error: () => false };",
    },
    {
      code: 'const result = Either.match({ onLeft: (left) => left, onRight: (right) => right })(either);',
    },
    {
      code: "function project<T>(value: T) { return { ok: true as const, value }; }",
    },
    {
      code: "// eslint-disable-next-line @rule-tester/manual-result -- suppression test\ntype Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };",
    },
  ],
  invalid: [
    {
      code: "type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };",
      errors: [{ messageId: "manualResult", data: { name: "Result" } }],
    },
    {
      code: 'type Either<L, R> = { readonly _tag: "Left"; readonly left: L } | { readonly _tag: "Right"; readonly right: R };',
      errors: [{ messageId: "manualResult", data: { name: "Either" } }],
    },
    {
      code: `
        const Result = {
          ok: <T>(value: T) => ({ ok: true as const, value }),
          err: <E>(error: E) => ({ ok: false as const, error }),
          match: <T, E, A>(
            input: { readonly ok: boolean; readonly value?: T; readonly error?: E },
            handlers: { readonly onOk: (value: T) => A; readonly onErr: (error: E) => A },
          ) => (input.ok ? handlers.onOk(input.value as T) : handlers.onErr(input.error as E)),
        };
      `,
      errors: [{ messageId: "manualResult", data: { name: "Result" } }],
    },
    {
      code: `
        const helpers = {
          left: <L>(left: L) => ({ _tag: "Left" as const, left }),
          right: <R>(right: R) => ({ _tag: "Right" as const, right }),
          flatMap: (input: unknown) => input,
        };
      `,
      errors: [{ messageId: "manualResult", data: { name: "helpers" } }],
    },
    {
      code: "function ok<T>(value: T) { return { ok: true as const, value }; }",
      errors: [{ messageId: "manualResult", data: { name: "ok" } }],
    },
  ],
});
