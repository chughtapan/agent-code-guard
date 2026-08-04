/**
 * @file Exercises numeric coercion, prototype mutation, and descriptor accessor bans through globals, computed properties, and aliases.
 */

import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { noDefinePropertyAccessors } from "./descriptor-accessors.js";
import {
  noPrototypeManipulation,
  noUnsafeNumericCoercion,
} from "./mutation.js";

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

ruleTester.run("no-unsafe-numeric-coercion", noUnsafeNumericCoercion, {
  valid: [
    "const value = Number(input);",
    "const value = parseInt(input, 16);",
    "const value = Number.parseInt(input, 16);",
    "const parse = Number.parseInt; const value = parse(input, 16);",
    "const parseFloat = (value: string) => value; const parsed = parseFloat(input);",
    "const Number = { parseInt: (value: string) => value }; const parsed = Number.parseInt(input);",
    "const Number = { parseInt: (value: string, radix: number) => value }; const parse = Number.parseInt; const parsed = parse(input, 10);",
    "const Number = { parseFloat: (value: string) => value }; const { parseFloat: parse } = Number; const parsed = parse(input);",
    "const method = 'parseInt' as const; const Number = { parseInt: (value: string, radix: number) => value }; const parsed = Number[method](input, 10);",
    "const globalThis = { parseFloat: (value: string) => value }; const parsed = globalThis.parseFloat(input);",
    "const globalThis = { Number: { parseInt: (value: string) => value } }; const parsed = globalThis.Number.parseInt(input, 10);",
  ],
  invalid: [
    {
      code: "const value = parseFloat(input);",
      errors: [{ messageId: "parseFloat" }],
    },
    {
      code: "const value = parseInt(input, 10);",
      errors: [{ messageId: "parseInt" }],
    },
    {
      code: "const value = parseInt(input);",
      errors: [{ messageId: "parseInt" }],
    },
    {
      code: "const value = Number.parseFloat(input);",
      errors: [{ messageId: "parseFloat" }],
    },
    {
      code: "const value = Number.parseInt(input, 10);",
      errors: [{ messageId: "parseInt" }],
    },
    {
      code: "const value = Number['parseInt'](input);",
      errors: [{ messageId: "parseInt" }],
    },
    {
      code: "const method = 'parseInt' as const; const value = Number[method](input, 10);",
      errors: [{ messageId: "parseInt" }],
    },
    {
      code: "const value = globalThis.parseFloat(input);",
      errors: [{ messageId: "parseFloat" }],
    },
    {
      code: "const value = globalThis['parseInt'](input, 10);",
      errors: [{ messageId: "parseInt" }],
    },
    {
      code: "const value = globalThis.Number.parseInt(input, 10);",
      errors: [{ messageId: "parseInt" }],
    },
    {
      code: "const parse = Number.parseInt; const value = parse(input, 10);",
      errors: [{ messageId: "parseInt" }],
    },
    {
      code: "const { parseFloat: parse } = Number; const value = parse(input);",
      errors: [{ messageId: "parseFloat" }],
    },
    {
      code: "const value = +input;",
      errors: [{ messageId: "unaryPlus" }],
    },
  ],
});

ruleTester.run("no-prototype-manipulation", noPrototypeManipulation, {
  valid: [
    "class Widget { value = 1; }",
    "Object.defineProperty(target, 'value', { value: 1 });",
    "const Object = { assign: () => undefined }; Object.assign(Widget.prototype, { value: 1 });",
    "const Reflect = { defineProperty: () => true }; Reflect.defineProperty(Widget.prototype, 'value', { value: 1 });",
    "const globalThis = { Object: { setPrototypeOf: () => undefined } }; globalThis.Object.setPrototypeOf(target, parent);",
    "const Object = { setPrototypeOf: () => undefined }; const O = Object; O.setPrototypeOf(target, parent);",
    "const Object = { setPrototypeOf: () => undefined }; const setPrototypeOf = Object.setPrototypeOf; setPrototypeOf(target, parent);",
    "const value = { ['__proto__']: parent };",
  ],
  invalid: [
    {
      code: "Widget.prototype.value = 1;",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "Object.setPrototypeOf(target, parent);",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "const method = 'setPrototypeOf' as const; Object[method](target, parent);",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "Object.defineProperty(Widget.prototype, 'value', { value: 1 });",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "delete Widget.prototype.value;",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "Object.assign(Widget.prototype, { value: 1 });",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "Object.defineProperties(Widget.prototype, { value: { value: 1 } });",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "Reflect.defineProperty(Widget.prototype, 'value', { value: 1 });",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "Reflect.deleteProperty(Widget.prototype, 'value');",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "globalThis.Object.defineProperty(Widget.prototype, 'value', { value: 1 });",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "const O = Object; O.setPrototypeOf(target, parent);",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "const define = Reflect.defineProperty; define(Widget.prototype, 'value', { value: 1 });",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "const { assign } = Object; assign(Widget.prototype, { value: 1 });",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "const { set: reflectSet } = Reflect; reflectSet(Widget.prototype, 'value', 1);",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "const value = { __proto__: parent };",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "const value = { '__proto__': null };",
      errors: [{ messageId: "prototype" }],
    },
    {
      code: "Widget.prototype.count++;",
      errors: [{ messageId: "prototype" }],
    },
  ],
});

ruleTester.run("no-define-property-accessors", noDefinePropertyAccessors, {
  valid: [
    "Object.defineProperty(target, 'value', { value: 1 });",
    "class Store { get value(): number { return 1; } }",
    "const Object = { defineProperty: () => undefined }; Object.defineProperty(target, 'value', { get: () => 1 });",
    "const get = 'value' as const; Object.defineProperty(target, 'value', { [get]: 1 });",
    "const Object = { defineProperty: () => undefined }; const O = Object; O.defineProperty(target, 'value', { get: () => 1 });",
    "const Object = { defineProperty: () => undefined }; const define = Object.defineProperty; define(target, 'value', { get: () => 1 });",
  ],
  invalid: [
    {
      code: "Object.defineProperty(target, 'value', { get() { return 1; } });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "Object.defineProperty(target, 'value', { set(value) { target.value = value; } });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "Object.defineProperty(target, 'value', { 'get': () => 1 });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "Object['defineProperty'](target, 'value', { ['set']: (value) => { target.value = value; } });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "const method = 'defineProperty' as const; Object[method](target, 'value', { get: () => 1 });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "Object.defineProperties(target, { value: { get() { return 1; } } });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "Reflect.defineProperty(target, 'value', { get() { return 1; } });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "globalThis.Object.defineProperty(target, 'value', { get() { return 1; } });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "const O = Object; O.defineProperty(target, 'value', { get() { return 1; } });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "const define = Object.defineProperty; define(target, 'value', { get() { return 1; } });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "const { defineProperty } = Reflect; defineProperty(target, 'value', { get() { return 1; } });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "const { defineProperties: define } = Object; define(target, { value: { set(value) { target.value = value; } } });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "const descriptor = { get() { return 1; } }; Object.defineProperty(target, 'value', descriptor);",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "const descriptor = { set(value: number) { target.value = value; } }; const descriptors = { value: descriptor }; Object.defineProperties(target, descriptors);",
      errors: [{ messageId: "descriptorAccessor" }],
    },
    {
      code: "const get = 'get' as const; Object.defineProperty(target, 'value', { [get]: () => 1 });",
      errors: [{ messageId: "descriptorAccessor" }],
    },
  ],
});
