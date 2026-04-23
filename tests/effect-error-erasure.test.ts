import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/effect-error-erasure.js";

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

ruleTester.run("effect-error-erasure", rule, {
  valid: [
    {
      code: 'const fail = () => Effect.fail(new NotConnectedError({ message: "nope" }));',
    },
    {
      code: "const run = effect.pipe(Effect.mapError((err) => new ConfigLoadError({ cause: err })));",
    },
    {
      code: "const ok = () => Effect.succeed(new Error('boom'));",
    },
    {
      code: "const fail = () => OtherEffect.fail(new Error('boom'));",
    },
    {
      code: "const fail = () => Effect['fail'](new Error('boom'));",
    },
    {
      code: "const err = new Error('boom');",
    },
    {
      code: "const noop = Effect.fail();",
    },
    {
      code: "const mapped = effect.pipe(Effect.mapError((err) => err));",
    },
    {
      code: "const mapped = effect.pipe(Effect.map(() => new Error('boom')));",
    },
    {
      code: "const mapped = effect.pipe(Effect.mapError());",
    },
    {
      code: "const mapped = effect.pipe(Effect.mapError(err));",
    },
    {
      code: "class Tool { #fail(err) { return err; } run(Effect) { return Effect.#fail(new Error('boom')); } }",
    },
    {
      code: "const mapped = effect.pipe(Effect.mapError(...mappers));",
    },
    {
      code: "// eslint-disable-next-line @rule-tester/effect-error-erasure -- suppression test\nconst fail = () => Effect.fail(new Error('boom'));",
    },
  ],
  invalid: [
    {
      code: "const fail = () => Effect.fail(new Error('boom'));",
      errors: [{ messageId: "effectErrorErasure" }],
    },
    {
      code: "done(Effect.fail(new TypeError('bad arg')));",
      errors: [{ messageId: "effectErrorErasure" }],
    },
    {
      code: "const mapped = effect.pipe(Effect.mapError(() => new Error('boom')));",
      errors: [{ messageId: "effectErrorErasure" }],
    },
    {
      code: "const mapped = effect.pipe(Effect.mapError(function (err) { return new RangeError(String(err)); }));",
      errors: [{ messageId: "effectErrorErasure" }],
    },
    {
      code: "const mapped = effect.pipe(Effect.mapError((err) => new TypeError(String(err))));",
      errors: [{ messageId: "effectErrorErasure" }],
    },
    {
      code: "const mapped = effect.pipe(Effect.mapError((err) => { return new Error('boom'); return new ConfigLoadError({ cause: err }); }));",
      errors: [{ messageId: "effectErrorErasure" }],
    },
  ],
});
