import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "../src/rules/either-discriminant.js";

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

ruleTester.run("either-discriminant", rule, {
  valid: [
    {
      code: "const rendered = Either.match({ onLeft: (left) => left, onRight: (right) => right })(either);",
    },
    {
      code: "const ok = Maybe.isLeft(result);",
    },
    {
      code: "const ok = Either['isLeft'](result);",
    },
    {
      code: 'if (opt._tag === "Some") return opt.value;',
    },
    {
      code: 'if ("Left" === kind) return;',
    },
    {
      code: 'switch (event._tag) { case "LeftTurn": return; default: return; }',
    },
    {
      code: 'if (result._tag === other._tag) return;',
    },
    {
      code: 'if (result._tag > "Left") return;',
    },
    {
      code: 'switch (result.tag) { case "Left": return; default: return; }',
    },
    {
      code: 'class Box { #_tag = "Left"; run() { if ("Left" === this.#_tag) return; } }',
    },
    {
      code: "class Tool { #isLeft(result) { return result; } run(Either, result) { return Either.#isLeft(result); } }",
    },
    {
      code: "// eslint-disable-next-line @rule-tester/either-discriminant -- suppression test\nif (result._tag === 'Left') return;",
    },
  ],
  invalid: [
    {
      code: "if (Either.isLeft(result)) return result.left;",
      errors: [{ messageId: "eitherDiscriminant" }],
    },
    {
      code: "const ok = Either.isRight(result);",
      errors: [{ messageId: "eitherDiscriminant" }],
    },
    {
      code: 'if (result._tag === "Left") return;',
      errors: [{ messageId: "eitherDiscriminant" }],
    },
    {
      code: 'if ("Left" === result._tag) return;',
      errors: [{ messageId: "eitherDiscriminant" }],
    },
    {
      code: 'if (result?._tag === "Right") return;',
      errors: [{ messageId: "eitherDiscriminant" }],
    },
    {
      code: 'switch (result._tag) { case "Right": return; default: return; }',
      errors: [{ messageId: "eitherDiscriminant" }],
    },
  ],
});
