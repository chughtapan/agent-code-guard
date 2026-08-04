import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { preferStepdownFunctionOrder as rule } from "./prefer-stepdown-function-order.js";
import { stepdownRuleTester } from "./stepdown-test-support.js";

stepdownRuleTester().run("prefer-stepdown-function-order: top-level", rule, {
  valid: [
    {
      name: "exported functions precede internal callees",
      code: `
        export function load() { return read(); }
        function read() { return "value"; }
      `,
    },
    {
      name: "top-level export specifiers classify local declarations",
      code: `
        function load() { return read(); }
        function read() { return "value"; }
        export { load };
      `,
    },
    {
      name: "type-only export specifiers do not classify function values as exported",
      code: `
        function helper() { return "value"; }
        export type { helper };
      `,
    },
    {
      name: "anonymous default exports occupy the exported band but have no lexical target",
      code: `
        export default function() { return helper(); }
        function helper() { return "value"; }
      `,
    },
    {
      name: "cross-band reverse calls do not override the exported story band",
      code: `
        export function publicApi() { return "value"; }
        function internal() { return publicApi(); }
      `,
    },
    {
      name: "overload signatures attach to their implementation",
      code: `
        function load(value: string): string;
        function load(value: number): number;
        function load(value: string | number) { return value; }
      `,
    },
    {
      name: "aliases imports globals and shadowed names are excluded",
      code: `
        import { read as importedRead } from "./other.js";
        function read() { return "local"; }
        function caller() {
          const alias = read;
          const read = () => "shadowed";
          alias();
          read();
          importedRead();
          console.log(read());
        }
      `,
    },
    {
      name: "nested functions callbacks and function expressions are excluded",
      code: `
        function helper() { return "value"; }
        function caller() {
          const callback = () => helper();
          [1].map(function() { return helper(); });
          return callback;
        }
      `,
    },
  ],
  invalid: [
    {
      name: "band diagnostics do not depend on calls",
      code: `
        function internal() { return "value"; }
        export function exported() { return "value"; }
      `,
      errors: [{ messageId: "declarationOutOfStoryBand" }],
      output: null,
    },
    {
      name: "anonymous default export reports at its function declaration",
      code: `
        function internal() { return "value"; }
        export default function() { return "value"; }
      `,
      errors: [{ messageId: "declarationOutOfStoryBand", line: 3, type: AST_NODE_TYPES.FunctionDeclaration }],
      output: null,
    },
    {
      name: "a direct lexical call reports when caller follows callee",
      code: `
        function read() { return "value"; }
        function load() { return read(); }
      `,
      errors: [{ messageId: "callerMustPrecedeCallee" }],
      output: null,
    },
    {
      name: "an overload implementation is the direct lexical-call target",
      code: `
        function read(value: string): string;
        function read(value: number): number;
        function read(value: string | number) { return value; }
        function load() { return read("value"); }
      `,
      errors: [{ messageId: "callerMustPrecedeCallee" }],
      output: null,
    },
  ],
});
