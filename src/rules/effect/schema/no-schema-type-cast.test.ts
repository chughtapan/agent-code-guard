/**
 * @file Rejects assertions to Schema Type and Encoded projections in long and short forms while allowing normal casts and decoders.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { noSchemaTypeCast as rule } from "./no-schema-type-cast.js";
import * as tsParser from "@typescript-eslint/parser";

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

ruleTester.run("no-schema-type-cast", rule, {
  valid: [
    // Plain casts to other types are not in scope
    { code: "const x = value as string;" },
    { code: "const u = value as User;" },
    // Cast to the raw Schema (not Schema.Type)
    { code: "const s = value as Schema.Schema<A, I>;" },
    // Proper decode usage
    { code: "const decoded = Schema.decodeUnknownSync(MySchema)(input);" },
    // Cast to a similarly named identifier that isn't Schema.Type
    { code: "const x = value as MyType;" },
  ],
  invalid: [
    // The classic shape
    {
      code: "const u = value as Schema.Schema.Type<typeof UserSchema>;",
      errors: [{ messageId: "schemaTypeCast" }],
    },
    // Schema.Schema.Encoded
    {
      code: "const wire = value as Schema.Schema.Encoded<typeof UserSchema>;",
      errors: [{ messageId: "schemaTypeCast" }],
    },
    // Short form Schema.Type
    {
      code: "const u = value as Schema.Type<typeof UserSchema>;",
      errors: [{ messageId: "schemaTypeCast" }],
    },
    // Short form Schema.Encoded
    {
      code: "const w = value as Schema.Encoded<typeof UserSchema>;",
      errors: [{ messageId: "schemaTypeCast" }],
    },
    // Inside a function argument
    {
      code: "doThing(input as Schema.Schema.Type<typeof Foo>);",
      errors: [{ messageId: "schemaTypeCast" }],
    },
  ],
});
