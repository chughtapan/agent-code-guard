/* eslint-disable max-lines -- The exhaustive class-order fixture matrix is intentionally kept in one RuleTester table. */
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import * as tsParser from "@typescript-eslint/parser";
import { preferStepdownFunctionOrder as rule } from "./prefer-stepdown-function-order.js";
import { stepdownRuleTester } from "./stepdown-test-support.js";

const ruleTester = stepdownRuleTester();

ruleTester.run("prefer-stepdown-function-order: classes", rule, {
  valid: [
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
      name: "an abstract signature remains excluded after a private method",
      code: `
        abstract class Service {
          private secret() { return "value"; }
          abstract declared(): string;
        }
      `,
    },
    {
      name: "computed identifier keys remain excluded from direct this identifier calls",
      code: `
        const hidden = "hidden";
        class Service {
          public [hidden]() { return "value"; }
          public run() { return this.hidden(); }
        }
      `,
    },
    {
      name: "constructors are eligible but have no callable method key",
      code: `
        class Service {
          constructor() { this.run(); }
          public run() { return "value"; }
        }
      `,
    },
    {
      name: "computed literal and non-literal method keys are excluded from direct this resolution",
      code: `
        const method = "read";
        class Service {
          public ["read"]() { return "value"; }
          public [method]() { return "value"; }
          public run() { return this.read(); }
        }
      `,
    },
    {
      name: "a computed method is never a direct target for a computed this call",
      code: `
        const key = "read";
        class Service {
          public [key]() { return "value"; }
          public run() { return this["read"](); }
        }
      `,
    },
    {
      name: "numeric literal keys are eligible declarations but not direct method names",
      code: `
        class Service {
          public 1() { return "value"; }
          public run() { return this.read(); }
          public read() { return "value"; }
        }
      `,
    },
    {
      name: "noncomputed string-literal keys are excluded from direct identifier resolution",
      code: `
        class Service {
          public "read"() { return "value"; }
          public run() { return this.read(); }
        }
      `,
    },
    {
      name: "duplicate class method names are excluded as ambiguous targets",
      code: `
        class Service {
          public read() { return "first"; }
          public read() { return "second"; }
          public run() { return this.read(); }
        }
      `,
    },
    {
      name: "self recursion and a later same-band callee do not conflict with a prior caller",
      code: `
        class Service {
          public run() { this.run(); return this.read(); }
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
      name: "calls through another object and across story bands are excluded",
      code: `
        class Service {
          public read() { return "value"; }
          public run() { const other = this; return other.read(); }
          #secret() { return this.read(); }
        }
      `,
    },
    {
      name: "a class caller never follows a same-band top-level callee",
      code: `
        function read() { return "top-level"; }
        class Service {
          public first() { return "value"; }
          public run() { return read(); }
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
    {
      name: "excluded accessors and decorated methods do not enter public ordering after private methods",
      code: `
        class Service {
          private secret() { return "value"; }
          get result() { return "value"; }
          @trace() public decorated() { return "value"; }
        }
      `,
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, ecmaFeatures: { legacyDecorators: true } } },
    },
  ],
  invalid: [
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
        {
          message: "middle belongs to the public/protected story band, which must precede an earlier private declaration.",
          line: 4,
          column: 21,
          endLine: 4,
          endColumn: 27,
          type: AST_NODE_TYPES.Identifier,
        },
        {
          message: "constructor belongs to the constructor story band, which must precede an earlier private declaration.",
          line: 5,
          column: 11,
          endLine: 5,
          endColumn: 22,
          type: AST_NODE_TYPES.Identifier,
        },
        {
          message: "run belongs to the public/protected story band, which must precede an earlier private declaration.",
          line: 6,
          column: 18,
          endLine: 6,
          endColumn: 21,
          type: AST_NODE_TYPES.Identifier,
        },
      ],
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
      errors: [{
        message: "run must precede its direct local callee read in the public/protected story band.",
        line: 4,
        column: 33,
        endLine: 4,
        endColumn: 44,
        type: AST_NODE_TYPES.CallExpression,
      }],
      output: null,
    },
    {
      name: "private and public names use separate target namespaces",
      code: `
        class Service {
          public secret() { return "public"; }
          #secret() { return "private"; }
          #run() { return this.#secret(); }
        }
      `,
      errors: [{
        message: "run must precede its direct local callee secret in the private story band.",
        type: AST_NODE_TYPES.CallExpression,
      }],
      output: null,
    },
    {
      name: "class expressions nested in functions receive class-body analysis",
      code: `
        function createService() {
          return class Service {
            public read() { return "value"; }
            public run() { return this.read(); }
          };
        }
      `,
      errors: [{
        message: "run must precede its direct local callee read in the public/protected story band.",
        type: AST_NODE_TYPES.CallExpression,
      }],
      output: null,
    },
  ],
});
/* eslint-enable max-lines -- End exhaustive class-order fixture table. */
