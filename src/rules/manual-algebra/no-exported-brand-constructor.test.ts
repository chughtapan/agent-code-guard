import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./no-exported-brand-constructor.js";

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

ruleTester.run("no-exported-brand-constructor", rule, {
  valid: [
    {
      code: `
        const UserId = Brand.nominal<UserId>();
        export type UserId = string & Brand.Brand<"UserId">;
        export const parseUserId = (input: string): UserId => UserId(input);
      `,
    },
    {
      code: `
        const UserSchema = Schema.Struct({ id: Schema.String });
        export type User = Schema.Schema.Type<typeof UserSchema>;
        export const parseUser = (input: unknown) => Schema.decodeUnknownSync(UserSchema)(input);
      `,
    },
    {
      code: `
        const UserSchema = z.object({ id: z.string() });
        export type User = z.infer<typeof UserSchema>;
        export const parseUser = (input: unknown): User => UserSchema.parse(input);
      `,
    },
    {
      code: `
        const User = Type.Object({ id: Type.String() });
        export const validateUser = TypeCompiler.Compile(User);
      `,
    },
  ],
  invalid: [
    {
      code: "export const UserId = Brand.nominal<UserId>();",
      errors: [
        {
          messageId: "exportedBrandConstructor",
          data: { kind: "brand", name: "UserId" },
        },
      ],
    },
    {
      code: "export const UserSchema = Schema.Struct({ id: Schema.String });",
      errors: [
        {
          messageId: "exportedBrandConstructor",
          data: { kind: "schema", name: "UserSchema" },
        },
      ],
    },
    {
      code: "export const UserSchema = z.object({ id: z.string() });",
      errors: [
        {
          messageId: "exportedBrandConstructor",
          data: { kind: "schema", name: "UserSchema" },
        },
      ],
    },
    {
      code: "export const User = Type.Object({ id: Type.String() });",
      errors: [
        {
          messageId: "exportedBrandConstructor",
          data: { kind: "schema", name: "User" },
        },
      ],
    },
    {
      code: `
        const UserSchema = z.object({ id: z.string() });
        export { UserSchema };
      `,
      errors: [
        {
          messageId: "exportedBrandConstructor",
          data: { kind: "schema", name: "UserSchema" },
        },
      ],
    },
  ],
});
