/**
 * @file Exercises calls fed by optional or nullable parameters, distinguishing explicit guards and defaults from unchecked flow.
 */

import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import * as fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { lintRule } from "../test-support/property-lint.js";
import { noConditionalChaining as rule } from "./no-conditional-chaining.js";

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

ruleTester.run("no-conditional-chaining", rule, {
  valid: [
    {
      code: `
        function parseUserId(id?: string) {
          if (id === undefined) return Effect.fail(new MissingUserIdError());
          return UserId(id);
        }
      `,
    },
    {
      code: `
        const normalizeUserId = (id: string | undefined) => {
          const resolvedId = id ?? "anonymous";
          return UserId(resolvedId);
        };
      `,
    },
    {
      code: `
        function decodeUserId(id: string | null) {
          if (id === null) throw new MissingUserIdError();
          return UserId(id);
        }
      `,
    },
    {
      code: `
        function loadUser(id: string) {
          return fetchUser(id);
        }
      `,
    },
    {
      code: `
        function loadUser(id?: string) {
          if (id === undefined) return Effect.fail(new MissingUserIdError());
          return fetchUser(id);
        }
      `,
    },
    {
      code: `
        function loadUser(id: string | null) {
          if (id === null) throw new MissingUserIdError();
          return fetchUser(id);
        }
      `,
    },
    {
      code: `
        const loadUser = (id: string | undefined) => {
          const resolvedId = id ?? "anonymous";
          return fetchUser(resolvedId);
        };
      `,
    },
  ],
  invalid: [
    {
      code: "function loadUser(id?: string) { return fetchUser(id); }",
      errors: [{ messageId: "conditionalChaining", data: { name: "id" } }],
    },
    {
      code: "const loadUser = (id: string | undefined) => fetchUser(id);",
      errors: [{ messageId: "conditionalChaining", data: { name: "id" } }],
    },
    {
      code: "function loadUser(id: string | null) { return service.fetch(id); }",
      errors: [{ messageId: "conditionalChaining", data: { name: "id" } }],
    },
    {
      code: `
        function loadUser(id?: string) {
          return fetchUser(normalize(id));
        }
      `,
      errors: [{ messageId: "conditionalChaining", data: { name: "id" } }],
    },
    {
      code: `
        function loadUser({ id }: { readonly id?: string }) {
          return fetchUser(id);
        }
      `,
      errors: [{ messageId: "conditionalChaining", data: { name: "id" } }],
    },
  ],
});

const typeNameArb = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);
const valueNameArb = fc.stringMatching(/^[a-z][a-zA-Z]{2,8}$/);
const paramNameArb = fc.constantFrom("id", "key", "input", "token");

const nullableParameterArb = fc.tuple(
  paramNameArb,
  fc.constantFrom(
    (name: string) => `${name}?: string`,
    (name: string) => `${name}: string | undefined`,
    (name: string) => `${name}: string | null`,
    (name: string) => `{ ${name} }: { readonly ${name}?: string }`,
  ),
);

const boundaryPrefixArb = fc.constantFrom("decode", "from", "normalize", "parse", "read", "resolve");

describe("property: conditional chaining", () => {
  it("optional/nullish parameters fire in non-boundary functions", () => {
    fc.assert(
      fc.property(valueNameArb, nullableParameterArb, (suffix, [paramName, renderParam]) => {
        const functionName = `load${suffix[0]?.toUpperCase() ?? "X"}${suffix.slice(1)}`;
        const code = `function ${functionName}(${renderParam(paramName)}) { return fetchUser(${paramName}); }`;
        expect(lintRule(code, "agent-code-guard/no-conditional-chaining")).toHaveLength(1);
      }),
      { numRuns: 60 },
    );
  });

  it("explicit boundary parser/normalizer names may accept optional/nullish parameters", () => {
    fc.assert(
      fc.property(boundaryPrefixArb, typeNameArb, nullableParameterArb, (prefix, suffix, [paramName, renderParam]) => {
        const code = `function ${prefix}${suffix}(${renderParam(paramName)}) { return ${suffix}(${paramName}); }`;
        expect(lintRule(code, "agent-code-guard/no-conditional-chaining")).toHaveLength(0);
      }),
      { numRuns: 60 },
    );
  });
});
