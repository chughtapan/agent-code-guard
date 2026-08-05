/**
 * @file Checks exported direct brand-cast constructors across declarations and exports while allowing non-exported helper boundaries.
 */

import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import * as fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { lintRule } from "../test-support/property-lint.js";
import { noExportedBrandConstructor as rule } from "./no-exported-brand-constructor.js";

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

const typeNameArb = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);

const exportedConstructorArb = typeNameArb.chain((name) =>
  fc.constantFrom(
    { expression: `Brand.nominal<${name}>()`, expectedKind: "brand", name },
    { expression: "Schema.Struct({ id: Schema.String })", expectedKind: "schema", name: `${name}Schema` },
    { expression: "z.object({ id: z.string() })", expectedKind: "schema", name: `${name}Schema` },
    { expression: "Type.Object({ id: Type.String() })", expectedKind: "schema", name },
  ),
);

describe("property: exported constructors", () => {
  it("exported brand/schema constructors fire across supported constructor families", () => {
    fc.assert(
      fc.property(exportedConstructorArb, (sample) => {
        const code = `export const ${sample.name} = ${sample.expression};`;
        const messages = lintRule(code, "agent-code-guard/no-exported-brand-constructor");
        expect(messages).toHaveLength(1);
        expect(messages[0]?.message).toContain(sample.expectedKind);
      }),
      { numRuns: 40 },
    );
  });

  it("named re-exports of local constructors fire while local constructors behind parsers stay clean", () => {
    fc.assert(
      fc.property(exportedConstructorArb, (sample) => {
        const reexport = `const ${sample.name} = ${sample.expression};\nexport { ${sample.name} };`;
        const localBoundary =
          `const ${sample.name} = ${sample.expression};\n` +
          `export const parse${sample.name} = (input: unknown) => input;`;
        expect(lintRule(reexport, "agent-code-guard/no-exported-brand-constructor")).toHaveLength(1);
        expect(lintRule(localBoundary, "agent-code-guard/no-exported-brand-constructor")).toHaveLength(0);
      }),
      { numRuns: 40 },
    );
  });
});
