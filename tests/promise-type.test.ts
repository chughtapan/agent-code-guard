import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/promise-type.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
});

ruleTester.run("promise-type", rule, {
  valid: [
    // Non-Promise TSTypeReference in return position — kills lines 7-9 typeName.name→true
    // mutation AND line 56 if(false)return mutation: if the isPromiseTypeReference guard is
    // bypassed, isReturnTypeAnnotation returns true here and the rule would incorrectly fire.
    { code: "function f(): Map<string, number> { return new Map(); }" },
    // Existing: primitive return
    { code: "function foo(): number { return 1; }" },
    // Promise as generic argument (not return annotation) — not a function return
    { code: "const m: Map<string, Promise<number>> = new Map();" },
    // Promise in type alias — parent is TSTypeAliasDeclaration, not TSTypeAnnotation
    { code: "type X = Promise<number>;" },
    // Variable annotation with Promise — owner is VariableDeclarator, hits switch default.
    // Kills the `default: return false → return true` mutation (lines 21/31/33).
    { code: "const p: Promise<number> = Promise.resolve(1);" },
    // Promise in parameter type — annotation IS TSTypeAnnotation but owner is the param
    // identifier, not a function. Exercises non-return annotation path.
    { code: "function f(p: Promise<number>): void {}" },
    { code: "const f = (p: Promise<number>): void => {};" },
    // Promise in union return type — TSTypeReference parent is TSUnionType, not
    // TSTypeAnnotation. Exercises the annotation.type !== TSTypeAnnotation branch (line 17).
    { code: "function f(): Promise<number> | string { return ''; }" },
    { code: "const f = (): Promise<number> | null => null;" },
    // Function with no return annotation — Promise only in body, no TSTypeReference visited
    // for the function's return annotation at all.
    { code: "function f() { return Promise.resolve(1); }" },
    // Suppression test
    {
      code: "// eslint-disable-next-line @rule-tester/promise-type -- suppression test (real prefix in production is `safer-by-default/promise-type`)\nfunction suppressed(): Promise<number> { return Promise.resolve(1); }",
    },
    // Promise nested in an intersection in return position — not direct annotation
    { code: "function f(): Promise<number> & { tag: string } { return Promise.resolve(1) as any; }" },
  ],
  invalid: [
    // FunctionDeclaration
    {
      code: "function foo(): Promise<number> { return Promise.resolve(1); }",
      errors: [{ messageId: "promiseReturn" }],
    },
    // ArrowFunctionExpression
    {
      code: "const foo = (): Promise<void> => Promise.resolve();",
      errors: [{ messageId: "promiseReturn" }],
    },
    // FunctionExpression inside class method
    {
      code: "class C { m(): Promise<number> { return Promise.resolve(1); } }",
      errors: [{ messageId: "promiseReturn" }],
    },
    // FunctionExpression (named function expression)
    {
      code: "const foo = function (): Promise<number> { return Promise.resolve(1); };",
      errors: [{ messageId: "promiseReturn" }],
    },
    // TSDeclareFunction
    {
      code: "declare function foo(): Promise<number>;",
      errors: [{ messageId: "promiseReturn" }],
    },
    // TSMethodSignature
    {
      code: "interface I { m(): Promise<number>; }",
      errors: [{ messageId: "promiseReturn" }],
    },
    // TSFunctionType — covers the no-cov TSFunctionType switch branch
    {
      code: "type F = () => Promise<number>;",
      errors: [{ messageId: "promiseReturn" }],
    },
    // TSEmptyBodyFunctionExpression — abstract method covers no-cov branch
    {
      code: "abstract class A { abstract m(): Promise<number>; }",
      errors: [{ messageId: "promiseReturn" }],
    },
    // async arrow — ensures async keyword does not suppress the rule
    {
      code: "const g = async (): Promise<void> => {};",
      errors: [{ messageId: "promiseReturn" }],
    },
  ],
});
