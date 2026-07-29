import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { componentFunctionNaming } from "./component-function-naming.js";

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
      code: "import * as R from 'react'; function userCard() { return R.createElement('div'); }",
      errors: [{ messageId: "componentUpperCamel" }],
      filename: "component.tsx",
    },
    {
      code: "import { createElement as h } from 'react'; function userCard() { return h('div'); }",
      errors: [{ messageId: "componentUpperCamel" }],
      filename: "component.tsx",
    },
    {
      code: "function userList() { return items.map((item) => <div>{item}</div>); }",
      errors: [{ messageId: "componentUpperCamel" }],
      filename: "component.tsx",
    },
    {
      code: "function ReadValue() { function Inner() { return <div />; } return 1; }",
      errors: [{ messageId: "ordinaryLowerCamel" }],
      filename: "component.tsx",
    },
    {
      code: "export function ParseValue(input: string): number | null { return input === '' ? null : Number(input); }",
      errors: [{ messageId: "ordinaryLowerCamel" }],
      filename: "component.tsx",
    },
    {
      code: "export function FindUser(): User | null { return null; }",
      errors: [{ messageId: "ordinaryLowerCamel" }],
      filename: "component.tsx",
    },
    {
      code: "function ReadValue() { const view = <div />; void view; return 1; }",
      errors: [{ messageId: "ordinaryLowerCamel" }],
      filename: "component.tsx",
    },
    {
      code: "const React = { createElement: () => 1 }; export function BuildValue() { return React.createElement(); }",
      errors: [{ messageId: "ordinaryLowerCamel" }],
      filename: "component.tsx",
    },
    {
      code: "const createElement = () => 1; export function BuildValue() { return createElement(); }",
      errors: [{ messageId: "ordinaryLowerCamel" }],
      filename: "component.tsx",
    },
    {
      code: "function BuildValue() { return items.map((item) => { const view = <div />; void view; return item; }); }",
      errors: [{ messageId: "ordinaryLowerCamel" }],
      filename: "component.tsx",
    },
    {
      code: "function ReadValue() { return 1; } function Container() { const ReadValue = () => null; return <ReadValue />; }",
      errors: [{ messageId: "ordinaryLowerCamel" }],
      filename: "component.tsx",
    },
  ],
});
