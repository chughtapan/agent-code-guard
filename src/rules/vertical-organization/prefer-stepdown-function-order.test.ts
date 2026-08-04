import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { preferStepdownFunctionOrder as rule } from "./prefer-stepdown-function-order.js";

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

ruleTester.run("prefer-stepdown-function-order", rule, {
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
      name: "class constructor public protected then private is ordered",
      code: `
        class Service {
          constructor() { this.run(); }
          public run() { return this.protectedStep(); }
          protected protectedStep() { return this.secret(); }
          #secret() { return "value"; }
        }
      `,
    },
    {
      name: "static and instance methods share their band without crossing staticness",
      code: `
        class Service {
          public static run() { return this.read(); }
          public static read() { return "value"; }
          public instance() { return this.instanceRead(); }
          public instanceRead() { return "value"; }
        }
      `,
    },
    {
      name: "staticness mismatches do not create a this-method edge",
      code: `
        class Service {
          public static read() { return "value"; }
          public static run() { return this.instanceRead(); }
          public instanceRead() { return "value"; }
        }
      `,
    },
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
      name: "overload signatures attach to their implementation",
      code: `
        function load(value: string): string;
        function load(value: number): number;
        function load(value: string | number) { return value; }
      `,
    },
    {
      name: "abstract and signature-only methods are excluded",
      code: `
        abstract class Service {
          abstract declared(): string;
          public run() { return this.read(); }
          public read() { return "value"; }
        }
      `,
    },
    {
      name: "an override remains a syntactic this-method narrative edge",
      code: `
        class Base {
          public run() { return this.read(); }
          public read() { return "base"; }
        }
        class Derived extends Base {
          public read() { return "derived"; }
        }
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
      name: "optional computed super and class-qualified calls are excluded",
      code: `
        class Base { public read() { return "base"; } }
        class Service extends Base {
          public run() {
            this?.read();
            this["read"]();
            super.read();
            Service.make();
          }
          public read() { return "value"; }
          public static make() { return "value"; }
        }
      `,
    },
    {
      name: "decorated methods accessors fields and static blocks are excluded",
      code: `
        class Service {
          static { Service.setup(); }
          value = this.read();
          @trace() public decorated() { return this.read(); }
          get result() { return this.read(); }
          public run() { return this.read(); }
          public read() { return "value"; }
          public static setup() { return "value"; }
        }
      `,
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, ecmaFeatures: { legacyDecorators: true } } },
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
      name: "class band diagnostics do not depend on calls",
      code: `
        class Service {
          private secret() { return "value"; }
          protected middle() { return "value"; }
          constructor() {}
          public run() { return "value"; }
        }
      `,
      errors: [
        { messageId: "declarationOutOfStoryBand" },
        { messageId: "declarationOutOfStoryBand" },
        { messageId: "declarationOutOfStoryBand" },
      ],
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
    {
      name: "a direct same-staticness this call reports when caller follows callee",
      code: `
        class Service {
          public read() { return "value"; }
          public run() { return this.read(); }
        }
      `,
      errors: [{ messageId: "callerMustPrecedeCallee" }],
      output: null,
    },
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
