/**
 * @file Type-checks enum values used as conditions, Boolean calls, negation, logical operands, and loops while allowing comparisons.
 */

import { createTypedRuleTester } from "../utils/typed-linter/test-support/rule-tester.js";
import { noEnumBooleanCoercion } from "./enum-coercion.js";

const ruleTester = createTypedRuleTester();
const filename = "src/rules/utils/typed-linter/test-support/fixture.ts";

ruleTester.run("no-enum-boolean-coercion", noEnumBooleanCoercion, {
  valid: [
    {
      code: "enum State { OFF, ON }\nconst state = State.OFF;\nif (state === State.ON) {}",
      filename,
    },
    {
      code: "const count = 1;\nif (count > 0) {}",
      filename,
    },
    {
      code: "enum State { OFF, ON }\nconst state: State = State.OFF;\nconst fallback = state ?? State.ON;",
      filename,
    },
    {
      code: "enum State { OFF, ON }\nconst state: State = State.ON;\nfunction check(Boolean: (value: State) => boolean): boolean { return Boolean(state); }",
      filename,
    },
  ],
  invalid: [
    {
      code: "enum State { OFF, ON }\nconst state: State = State.OFF;\nif (state) {}",
      filename,
      errors: [{ messageId: "enumBoolean" }],
    },
    {
      code: "enum State { OFF, ON }\nconst state: State = State.ON;\nconst active = Boolean(state);",
      filename,
      errors: [{ messageId: "enumBoolean" }],
    },
    {
      code: "enum State { OFF, ON }\nconst state: State = State.ON;\nconst active = !state;",
      filename,
      errors: [{ messageId: "enumBoolean" }],
    },
    {
      code: "enum State { OFF, ON }\nconst state: State = State.ON;\nconst active = state ? 1 : 0;",
      filename,
      errors: [{ messageId: "enumBoolean" }],
    },
    {
      code: "enum State { OFF, ON }\nconst state: State = State.ON;\nwhile (state) { break; }",
      filename,
      errors: [{ messageId: "enumBoolean" }],
    },
    {
      code: "enum State { OFF, ON }\nconst state: State = State.ON;\ndo {} while (state);",
      filename,
      errors: [{ messageId: "enumBoolean" }],
    },
    {
      code: "enum State { OFF, ON }\nconst state: State = State.ON;\nfor (; state;) { break; }",
      filename,
      errors: [{ messageId: "enumBoolean" }],
    },
    {
      code: "enum State { OFF, ON }\nconst state: State = State.ON;\nconst active = state && true;",
      filename,
      errors: [{ messageId: "enumBoolean" }],
    },
  ],
});
