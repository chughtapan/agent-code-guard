import * as tsParser from "@typescript-eslint/parser";
import { preferStepdownFunctionOrder as rule } from "./prefer-stepdown-function-order.js";
import { stepdownRuleTester } from "./stepdown-test-support.js";

stepdownRuleTester().run("prefer-stepdown-function-order: classes", rule, {
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
      name: "a noncomputed string-literal method key is an identifier-call target",
      code: `
        class Service {
          public "read"() { return "value"; }
          public run() { return this.read(); }
        }
      `,
      errors: [{ messageId: "callerMustPrecedeCallee" }],
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
      errors: [{ messageId: "callerMustPrecedeCallee" }],
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
      errors: [{ messageId: "callerMustPrecedeCallee" }],
      output: null,
    },
  ],
});
