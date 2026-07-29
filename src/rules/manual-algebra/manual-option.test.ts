import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { manualOption as rule } from "./manual-option.js";
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

ruleTester.run("manual-option", rule, {
  valid: [
    {
      code: 'type SessionState<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };',
    },
    {
      code: 'const state = { _tag: "Some" as const, value };',
    },
    {
      code: "const Option = 1;",
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
      code: "const cache = { some: 1, none: null };",
    },
    {
      code: 'type MaybeState<T> = { readonly _tag: "Some"; readonly value: T } | { readonly _tag: "None" };',
    },
    {
      code: "type OptionState<T> = { readonly some: T; readonly none: null };",
    },
    {
      code: 'type Session = { readonly status: "Loading" } | { readonly status: "Loaded"; readonly value: string };',
    },
    {
      code: 'type Session = { readonly status: "Loading"; readonly match: () => string } | { readonly status: "Loaded"; readonly value: string };',
    },
    {
      code: 'const present = () => ({ _tag: "Missing" as const });',
    },
    {
      code: 'const absent = () => ({ _tag: "Missing" as const });',
    },
    {
      code: "const hasValue = (option: { current?: number }) => option.current;",
    },
    {
      code: 'const isNone = (option: { _tag: "Some" }) => option._tag === "Some";',
    },
    {
      code: "// eslint-disable-next-line @rule-tester/manual-option -- suppression test\ntype Option<T> = { readonly _tag: 'Some'; readonly value: T } | { readonly _tag: 'None' };",
    },
    {
      name: "a function that consumes Effect's Option is not hand-rolling one",
      code: `
        function renderPack(entry: Entry) {
          const label = Option.match(entry.summary, { onNone: () => "", onSome: (s) => s });
          return label === "" ? Option.none() : Option.some(label);
        }
      `,
    },
    {
      name: "consuming Option through an aliased namespace import",
      code: `
        import * as O from "effect/Option";
        const pick = (input: string | null) => {
          const held = input === null ? O.none() : O.some(input);
          return O.getOrElse(held, () => "fallback");
        };
      `,
    },
    {
      name: "consuming Either alongside Option",
      code: `
        function decode(raw: string) {
          const parsed = Either.match(read(raw), { onLeft: () => Option.none(), onRight: (v) => Option.some(v) });
          return Option.flatMap(parsed, (v) => Option.some(v));
        }
      `,
    },
    {
      name: "a locally shadowed Option namespace is still the library shape, not a definition",
      code: `
        const summarize = (rows: readonly string[]) =>
          rows.length === 0 ? Option.none() : Option.some(rows[0]);
      `,
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
    {
      code: 'const present = <T>(value: T) => ({ _tag: "Present" as const, value });',
      errors: [{ messageId: "manualOption", data: { name: "present" } }],
    },
    {
      code: 'const absent = () => ({ _tag: "Absent" as const });',
      errors: [{ messageId: "manualOption", data: { name: "absent" } }],
    },
    {
      code: "const hasValue = (option: { value?: number }) => option.value;",
      errors: [{ messageId: "manualOption", data: { name: "hasValue" } }],
    },
    {
      code: 'const isNone = (option: { _tag: "None" | "Some" }) => option._tag === "None";',
      errors: [{ messageId: "manualOption", data: { name: "isNone" } }],
    },
    {
      code: 'function some<T>(value: T) { return { _tag: "Some" as const, value }; }',
      errors: [{ messageId: "manualOption", data: { name: "some" } }],
    },
    {
      code: "interface Maybe<T> { readonly some: T; readonly none: null; map(value: T): T; }",
      errors: [{ messageId: "manualOption", data: { name: "Maybe" } }],
    },
    {
      code: "class Option { some() { return 1; } none() { return null; } }",
      errors: [{ messageId: "manualOption", data: { name: "Option" } }],
    },
    {
      code: "const Option = class { some() { return 1; } none() { return null; } };",
      errors: [{ messageId: "manualOption", data: { name: "Option" } }],
    },
  ],
});
