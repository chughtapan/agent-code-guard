import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { requireAssertionRationale } from "./assertions.js";
import { noPrivateIdentifiers, noRedundantPublic, noStaticThis } from "./classes.js";
import { componentFunctionNaming } from "./component-function-naming.js";
import { noUnsafeParameterDefaults } from "./expressions.js";
import { noNullishTypeAliases, preferOptionalOverUndefinedUnion } from "./type-shape.js";

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

ruleTester.run("no-nullish-type-aliases", noNullishTypeAliases, {
  valid: [
    "type UserName = string;",
    "interface User { name: string | null; }",
    "const value: string | undefined = undefined;",
  ],
  invalid: [
    {
      code: "type UserName = string | null;",
      errors: [{ messageId: "nullishAlias" }],
    },
    {
      code: "type Input = string | (number | undefined);",
      errors: [{ messageId: "nullishAlias" }],
    },
  ],
});

ruleTester.run("prefer-optional-over-undefined-union", preferOptionalOverUndefinedUnion, {
  valid: [
    "interface Input { value?: string; }",
    "function read(value?: string): void { void value; }",
    "class Store { value?: string; }",
  ],
  invalid: [
    {
      code: "interface Input { value: string | undefined; }",
      errors: [{ messageId: "preferOptional" }],
    },
    {
      code: "function read(value: string | undefined): void { void value; }",
      errors: [{ messageId: "preferOptional" }],
    },
    {
      code: "class Store { value: string | undefined; }",
      errors: [{ messageId: "preferOptional" }],
    },
    {
      code: "class Store { accessor value: string | undefined; }",
      errors: [{ messageId: "preferOptional" }],
    },
    {
      code: "abstract class Store { abstract value: string | undefined; }",
      errors: [{ messageId: "preferOptional" }],
    },
    {
      code: "function read(value: string | undefined = undefined): void { void value; }",
      errors: [{ messageId: "preferOptional" }],
    },
    {
      code: "type Reader = (value: string | undefined) => void;",
      errors: [{ messageId: "preferOptional" }],
    },
    {
      code: "interface Reader { (value: string | undefined): void; }",
      errors: [{ messageId: "preferOptional" }],
    },
    {
      code: "interface Reader { read(value: string | undefined): void; }",
      errors: [{ messageId: "preferOptional" }],
    },
    {
      code: "function read({ value }: { value: string } | undefined): void { void value; }",
      errors: [{ messageId: "preferOptional" }],
    },
  ],
});

ruleTester.run("no-static-this", noStaticThis, {
  valid: [
    "class Store { static value = 1; static read(): number { return Store.value; } }",
    "class Store { read(): Store { return this; } }",
  ],
  invalid: [
    {
      code: "class Store { static value = 1; static read(): number { return this.value; } }",
      errors: [{ messageId: "staticThis" }],
    },
    {
      code: "class Store { static build = (): typeof Store => this; }",
      errors: [{ messageId: "staticThis" }],
    },
    {
      code: "class Store { static value = 1; static { this.value = 2; } }",
      errors: [{ messageId: "staticThis" }],
    },
  ],
});

ruleTester.run("no-private-identifiers", noPrivateIdentifiers, {
  valid: ["class Store { private value = 1; }"],
  invalid: [
    {
      code: "class Store { #value = 1; }",
      errors: [{ messageId: "privateIdentifier" }],
    },
  ],
});

ruleTester.run("no-redundant-public", noRedundantPublic, {
  valid: [
    "class Store { value = 1; read(): number { return this.value; } }",
    "class Store { private value = 1; }",
    "class Store { constructor(public value: number) {} }",
    "abstract class Store { abstract value: number; abstract read(): number; }",
  ],
  invalid: [
    {
      code: "class Store { public value = 1; }",
      errors: [{ messageId: "redundantPublic" }],
    },
    {
      code: "class Store { public read(): number { return 1; } }",
      errors: [{ messageId: "redundantPublic" }],
    },
    {
      code: "class Store { constructor(public readonly value: number) {} }",
      errors: [{ messageId: "redundantPublic" }],
    },
    {
      code: "class Store { public accessor value = 1; }",
      errors: [{ messageId: "redundantPublic" }],
    },
    {
      code: "abstract class Store { public abstract value: number; }",
      errors: [{ messageId: "redundantPublic" }],
    },
    {
      code: "abstract class Store { public abstract read(): number; }",
      errors: [{ messageId: "redundantPublic" }],
    },
  ],
});

ruleTester.run("component-function-naming", componentFunctionNaming, {
  valid: [
    "function readValue(): number { return 1; }",
    "const FACTORY = (): number => 1;",
    "if (Either.isLeft(value)) return value.left;",
    {
      code: "function UserCard() { return <div />; }",
      filename: "component.tsx",
    },
    {
      code: "const UserCard = () => <div />;",
      filename: "component.tsx",
    },
    {
      code: "function UserCard(): null { return null; }\nconst view = <UserCard />;",
      filename: "component.tsx",
    },
    {
      code: "function renderLabel(): ReactNode { return 'label'; }",
      filename: "component.tsx",
    },
    {
      code: "export function UserCard() { return React.createElement('div'); }",
      filename: "component.tsx",
    },
    {
      code: "export function UserCard(): JSX.Element | null { return null; }",
      filename: "component.tsx",
    },
  ],
  invalid: [
    {
      code: "function ReadValue(): number { return 1; }",
      errors: [{ messageId: "ordinaryLowerCamel" }],
    },
    {
      code: "const ReadValue = (): number => 1;",
      errors: [{ messageId: "ordinaryLowerCamel" }],
    },
    {
      code: "function userCard() { return <div />; }",
      errors: [{ messageId: "componentUpperCamel" }],
      filename: "component.tsx",
    },
    {
      code: "const userCard = () => <div />;",
      errors: [{ messageId: "componentUpperCamel" }],
      filename: "component.tsx",
    },
    {
      code: "const userCard = function () { return <></>; };",
      errors: [{ messageId: "componentUpperCamel" }],
      filename: "component.tsx",
    },
    {
      code: "function userCard(): JSX.Element { throw new Error(); }",
      errors: [{ messageId: "componentUpperCamel" }],
      filename: "component.tsx",
    },
    {
      code: "function userCard() { return React.createElement('div'); }",
      errors: [{ messageId: "componentUpperCamel" }],
      filename: "component.tsx",
    },
    {
      code: "function ReadValue() { function Inner() { return <div />; } return 1; }",
      errors: [{ messageId: "ordinaryLowerCamel" }],
      filename: "component.tsx",
    },
    { code: "export function ParseValue(input: string): number | null { return input === '' ? null : Number(input); }", errors: [{ messageId: "ordinaryLowerCamel" }], filename: "component.tsx" },
    { code: "export function FindUser(): User | null { return null; }", errors: [{ messageId: "ordinaryLowerCamel" }], filename: "component.tsx" },
    { code: "function ReadValue() { const view = <div />; void view; return 1; }", errors: [{ messageId: "ordinaryLowerCamel" }], filename: "component.tsx" },
    { code: "const React = { createElement: () => 1 }; export function BuildValue() { return React.createElement(); }", errors: [{ messageId: "ordinaryLowerCamel" }], filename: "component.tsx" },
    { code: "function ReadValue() { return 1; } function Container() { const ReadValue = () => null; return <ReadValue />; }", errors: [{ messageId: "ordinaryLowerCamel" }], filename: "component.tsx" },
  ],
});

ruleTester.run("no-unsafe-parameter-defaults", noUnsafeParameterDefaults, {
  valid: [
    "function read(value = 1): number { return value; }",
    "function read({ value = 1 }: { value?: number } = {}): number { return value; }",
    "function read(values: readonly number[] = []): number { return values.length; }",
  ],
  invalid: [
    {
      code: "function read(value = load()): unknown { return value; }",
      errors: [{ messageId: "sideEffect" }],
    },
    {
      code: "function read({ value }: { value: number } = { value: 1 }): number { return value; }",
      errors: [{ messageId: "destructuringDefault" }],
    },
    {
      code: "function read(value = source.current): unknown { return value; }",
      errors: [{ messageId: "sideEffect" }],
    },
    {
      code: "function read({ user: { name } }: { user: { name: string } }): string { return name; }",
      errors: [{ messageId: "nestedDestructuring" }],
    },
    {
      code: "function read({ [key]: value }: Record<string, string>): string { return value; }",
      errors: [{ messageId: "computedDestructuring" }],
    },
    {
      code: "function read({ 'value': localValue }: { value: string }): string { return localValue; }",
      errors: [{ messageId: "computedDestructuring" }],
    },
    {
      code: "function read({ value: localValue }: { value: string }): string { return localValue; }",
      errors: [{ messageId: "computedDestructuring" }],
    },
  ],
});

ruleTester.run("require-assertion-rationale", requireAssertionRationale, {
  valid: [
    "const mode = 'strict' as const;",
    `const value = (
      // Safe because the boundary validated this value.
      input as string
    );`,
    `const value = (
      // Invariant guarantees the collection is non-empty.
      input!
    );`,
  ],
  invalid: [
    {
      code: "const value = input as string;",
      errors: [{ messageId: "rationale" }],
    },
    {
      code: "const value = <string>input;",
      errors: [{ messageId: "rationale" }],
    },
    {
      code: "const value = input!;",
      errors: [{ messageId: "rationale" }],
    },
    {
      code: "// cast\nconst value = input as string;",
      errors: [{ messageId: "rationale" }],
    },
  ],
});
