import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { preferStepdownFunctionOrder as rule } from "./prefer-stepdown-function-order.js";
import { stepdownRuleTester } from "./stepdown-test-support.js";

const ruleTester = stepdownRuleTester();

ruleTester.run("prefer-stepdown-function-order: top-level", rule, {
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
      name: "export classification accepts value specifiers but not re-exports or type specifiers",
      code: `
        function valueExport() { return helper(); }
        function typedExport() { return "typed"; }
        function reExported() { return "re-exported"; }
        function helper() { return "value"; }
        export { valueExport };
        export type { typedExport };
        export { reExported } from "./other.js";
      `,
    },
    {
      name: "export aliases still classify their local function by local name",
      code: `
        function localName() { return helper(); }
        function helper() { return "value"; }
        export { localName as publicName };
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
    {
      name: "optional direct calls and calls outside eligible functions are excluded",
      code: `
        function read() { return "value"; }
        read();
        function caller() { return read?.(); }
      `,
    },
    {
      name: "duplicate top-level declarations are not ambiguous lexical targets",
      code: `
        function read() { return "first"; }
        function read() { return "second"; }
        function caller() { return read(); }
      `,
    },
    {
      name: "a class method with the same name does not shadow the program target table",
      code: `
        function run() { return read(); }
        function read() { return "top-level"; }
        class Service { public read() { return "method"; } }
      `,
    },
    {
      name: "a top-level caller does not resolve a class this call",
      code: `
        function read() { return "value"; }
        function run() { return this.read(); }
      `,
    },
  ],
  invalid: [
    {
      name: "class method names do not make a top-level lexical target ambiguous",
      code: `
        function read() { return "top-level"; }
        function run() { return read(); }
        class Service { public read() { return "method"; } }
      `,
      errors: [{ messageId: "callerMustPrecedeCallee" }],
      output: null,
    },
    {
      name: "band diagnostics do not depend on calls",
      code: `
        function internal() { return "value"; }
        export function exported() { return "value"; }
      `,
      errors: [{
        message: "exported belongs to the exported story band, which must precede an earlier internal declaration.",
        line: 3,
        column: 25,
        endLine: 3,
        endColumn: 33,
        type: AST_NODE_TYPES.Identifier,
      }],
      output: null,
    },
    {
      name: "anonymous default export reports at its function declaration",
      code: `
        function internal() { return "value"; }
        export default function() { return "value"; }
      `,
      errors: [{
        message: "default export belongs to the exported story band, which must precede an earlier internal declaration.",
        line: 3,
        column: 24,
        endLine: 3,
        endColumn: 54,
        type: AST_NODE_TYPES.FunctionDeclaration,
      }],
      output: null,
    },
    {
      name: "a direct lexical call reports when caller follows callee",
      code: `
        function read() { return "value"; }
        function load() { return read(); }
      `,
      errors: [{
        message: "load must precede its direct local callee read in the internal story band.",
        line: 3,
        column: 34,
        endLine: 3,
        endColumn: 40,
        type: AST_NODE_TYPES.CallExpression,
      }],
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
      errors: [{
        message: "load must precede its direct local callee read in the internal story band.",
        line: 5,
        column: 34,
        endLine: 5,
        endColumn: 47,
        type: AST_NODE_TYPES.CallExpression,
      }],
      output: null,
    },
  ],
});
