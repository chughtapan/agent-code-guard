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
    {
      name: "a multi-member component can precede a separate callee component",
      code: `
        function first() { second(); return helper(); }
        function second() { return first(); }
        function helper() { return "value"; }
      `,
    },
    {
      name: "a shared helper follows every member of a cyclic caller component",
      code: `
        function first() { return second(); }
        function second() { first(); return helper(); }
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
      errors: [{
        message: "load must precede its direct local callee read in the internal story band.",
        line: 4,
        column: 11,
        endLine: 4,
        endColumn: 17,
      }],
      output: null,
    },
    {
      name: "an inter-component edge uses the component interval boundary",
      code: `
        function first() { return second(); }
        function helper() { return first(); }
        function second() { return first(); }
      `,
      errors: [{
        message: "helper must precede its direct local callee first in the internal story band.",
        line: 3,
        column: 36,
        endLine: 3,
        endColumn: 43,
      }],
      output: null,
    },
  ],
});
