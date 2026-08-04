import { preferStepdownFunctionOrder as rule } from "./prefer-stepdown-function-order.js";
import { stepdownRuleTester } from "./stepdown-test-support.js";

const ruleTester = stepdownRuleTester();

ruleTester.run("prefer-stepdown-function-order: graph", rule, {
  valid: [
    {
      name: "cycles do not produce intra-component diagnostics",
      code: `
        function first() { return second(); }
        function second() { return first(); }
      `,
    },
    {
      name: "shared callee follows every caller",
      code: `
        function first() { return helper(); }
        function second() { return helper(); }
        function helper() { return "value"; }
      `,
    },
  ],
  invalid: [
    {
      name: "the earliest repeated call is the only edge diagnostic",
      code: `
        function read() { return "value"; }
        function load() {
          read();
          return read();
        }
      `,
      errors: [{ messageId: "callerMustPrecedeCallee", line: 4 }],
      output: null,
    },
    {
      name: "an inter-component edge uses the component interval boundary",
      code: `
        function first() { return second(); }
        function helper() { return first(); }
        function second() { return first(); }
      `,
      errors: [{ messageId: "callerMustPrecedeCallee" }],
      output: null,
    },
  ],
});
