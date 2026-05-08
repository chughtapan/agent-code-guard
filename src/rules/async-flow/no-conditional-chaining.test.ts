import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./no-conditional-chaining.js";

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
