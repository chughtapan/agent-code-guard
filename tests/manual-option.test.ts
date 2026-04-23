import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/manual-option.js";

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

ruleTester.run("manual-option", rule, {
  valid: [
    {
      code: 'type SessionState<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };',
    },
    {
      code: 'const state = { _tag: "Some" as const, value };',
    },
    {
      code: 'type LoadingState = { readonly _tag: "Loading" } | { readonly _tag: "Loaded"; readonly value: string };',
    },
    {
      code: 'const found = Option.match({ onSome: (value) => value, onNone: () => "none" })(opt);',
    },
    {
      code: 'function select<T>(value: T) { return { _tag: "Some" as const, value }; }',
    },
    {
      code: "// eslint-disable-next-line @rule-tester/manual-option -- suppression test\ntype Option<T> = { readonly _tag: 'Some'; readonly value: T } | { readonly _tag: 'None' };",
    },
  ],
  invalid: [
    {
      code: 'type Option<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };',
      errors: [{ messageId: "manualOption", data: { name: "Option" } }],
    },
    {
      code: 'type Maybe<T> = { readonly _tag: "Present"; readonly value: T } | { readonly _tag: "Absent" };',
      errors: [{ messageId: "manualOption", data: { name: "Maybe" } }],
    },
    {
      code: `
        const Option = {
          some: <T>(value: T) => ({ _tag: "Some" as const, value }),
          none: { _tag: "None" as const },
          match: (input: unknown) => input,
        };
      `,
      errors: [{ messageId: "manualOption", data: { name: "Option" } }],
    },
    {
      code: `
        const helpers = {
          some: <T>(value: T) => ({ _tag: "Some" as const, value }),
          none: { _tag: "None" as const },
          flatMap: (fn: (value: number) => unknown) => fn(1),
        };
      `,
      errors: [{ messageId: "manualOption", data: { name: "helpers" } }],
    },
    {
      code: 'const some = <T>(value: T) => ({ _tag: "Some" as const, value });',
      errors: [{ messageId: "manualOption", data: { name: "some" } }],
    },
  ],
});
