import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/effect-promise.js";

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

ruleTester.run("effect-promise", rule, {
  valid: [
    {
      code: "const run = () => Effect.tryPromise({ try: () => fetch('/x'), catch: (cause) => new FetchError({ cause }) });",
    },
    {
      code: "const run = () => OtherEffect.promise(() => work());",
    },
    {
      code: "const run = () => promise(() => work());",
    },
    {
      code: "class Tool { #promise(fn) { return fn(); } run(Effect) { return Effect.#promise(() => 1); } }",
    },
    {
      code: "// eslint-disable-next-line @rule-tester/effect-promise -- suppression test\nconst run = () => Effect.promise(() => work());",
    },
  ],
  invalid: [
    {
      code: "const run = () => Effect.promise(() => fetch('/x'));",
      errors: [{ messageId: "effectPromise" }],
    },
    {
      code: "yield* Effect.promise(() => task());",
      errors: [{ messageId: "effectPromise" }],
    },
    {
      code: "const value = Effect.promise(async () => 1);",
      errors: [{ messageId: "effectPromise" }],
    },
  ],
});
