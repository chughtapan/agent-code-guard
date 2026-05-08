import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import plugin from "../index.js";

const parser: Linter.Parser = tsParser;
const pluginEntry: NonNullable<Linter.Config["plugins"]>[string] = plugin;

const linter = new Linter();

function configFor(ruleId: string): Linter.Config {
  return {
    files: ["**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: { "agent-code-guard": pluginEntry },
    rules: { [ruleId]: "error" },
  };
}

function lintOne(code: string, ruleId: string): Linter.LintMessage[] {
  return linter.verify(code, configFor(ruleId), { filename: "src/test.ts" });
}

function lintTestFile(code: string, ruleId: string): Linter.LintMessage[] {
  return linter.verify(code, configFor(ruleId), { filename: "src/example.test.ts" });
}

const typeNameArb = fc.stringMatching(/^[A-Z][a-zA-Z]{2,8}$/);
const valueNameArb = fc.stringMatching(/^[a-z][a-zA-Z]{2,8}$/);
const paramNameArb = fc.constantFrom("id", "key", "input", "token");

const exportedConstructorArb = typeNameArb.chain((name) =>
  fc.constantFrom(
    {
      expression: `Brand.nominal<${name}>()`,
      expectedKind: "brand",
      name,
    },
    {
      expression: "Schema.Struct({ id: Schema.String })",
      expectedKind: "schema",
      name: `${name}Schema`,
    },
    {
      expression: "z.object({ id: z.string() })",
      expectedKind: "schema",
      name: `${name}Schema`,
    },
    {
      expression: "Type.Object({ id: Type.String() })",
      expectedKind: "schema",
      name,
    },
  )
);

const nullableParameterArb = fc.tuple(paramNameArb, fc.constantFrom(
  (name: string) => `${name}?: string`,
  (name: string) => `${name}: string | undefined`,
  (name: string) => `${name}: string | null`,
  (name: string) => `{ ${name} }: { readonly ${name}?: string }`,
));

const boundaryPrefixArb = fc.constantFrom("decode", "from", "normalize", "parse", "read", "resolve");
const testFunctionArb = fc.constantFrom("it", "test");
const propertyPatternArb = fc.constantFrom(
  "fc.assert(fc.property(fc.integer(), (value) => { expect(value).toBe(value); }));",
  "fc.assert(fc.asyncProperty(fc.integer(), async (value) => { expect(value).toBe(value); }));",
  "it.prop([fc.integer()])('property case', (value) => { expect(value).toBe(value); });",
  "test.prop([fc.integer()])('property case', (value) => { expect(value).toBe(value); });",
);

describe("property: exported constructors", () => {
  it("exported brand/schema constructors fire across supported constructor families", () => {
    fc.assert(
      fc.property(exportedConstructorArb, (sample) => {
        const code = `export const ${sample.name} = ${sample.expression};`;
        const messages = lintOne(code, "agent-code-guard/no-exported-brand-constructor");
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
        expect(lintOne(reexport, "agent-code-guard/no-exported-brand-constructor")).toHaveLength(1);
        expect(lintOne(localBoundary, "agent-code-guard/no-exported-brand-constructor")).toHaveLength(0);
      }),
      { numRuns: 40 },
    );
  });
});

describe("property: conditional chaining", () => {
  it("optional/nullish parameters fire in non-boundary functions", () => {
    fc.assert(
      fc.property(valueNameArb, nullableParameterArb, (suffix, [paramName, renderParam]) => {
        const functionName = `load${suffix[0]?.toUpperCase() ?? "X"}${suffix.slice(1)}`;
        const code = `function ${functionName}(${renderParam(paramName)}) { return fetchUser(${paramName}); }`;
        expect(lintOne(code, "agent-code-guard/no-conditional-chaining")).toHaveLength(1);
      }),
      { numRuns: 60 },
    );
  });

  it("explicit boundary parser/normalizer names may accept optional/nullish parameters", () => {
    fc.assert(
      fc.property(boundaryPrefixArb, typeNameArb, nullableParameterArb, (prefix, suffix, [paramName, renderParam]) => {
        const code = `function ${prefix}${suffix}(${renderParam(paramName)}) { return ${suffix}(${paramName}); }`;
        expect(lintOne(code, "agent-code-guard/no-conditional-chaining")).toHaveLength(0);
      }),
      { numRuns: 60 },
    );
  });
});

describe("property: Effect error coalescing", () => {
  it("Effect error coalescing fires across broad error handlers", () => {
    fc.assert(
      fc.property(typeNameArb, fc.constantFrom("mapError", "catchAll", "catchAllCause"), (name, method) => {
        const errorName = `${name}Error`;
        const body = method === "mapError"
          ? `new ${errorName}({ cause })`
          : `Effect.fail(new ${errorName}({ cause }))`;
        const code = `const run = program.pipe(Effect.${method}((cause) => ${body}));`;
        expect(lintOne(code, "agent-code-guard/no-effect-error-coalescing")).toHaveLength(1);
      }),
      { numRuns: 60 },
    );
  });

  it("Effect error handlers that preserve the incoming error stay clean", () => {
    fc.assert(
      fc.property(fc.constantFrom("mapError", "catchAll", "catchAllCause"), (method) => {
        const body = method === "mapError" ? "err" : "Effect.fail(err)";
        const code = `const run = program.pipe(Effect.${method}((err) => ${body}));`;
        expect(lintOne(code, "agent-code-guard/no-effect-error-coalescing")).toHaveLength(0);
      }),
      { numRuns: 30 },
    );
  });
});

describe("property: manual brand constructors", () => {
  it("manual brand constructors fire for constructor-like helper names only", () => {
    fc.assert(
      fc.property(typeNameArb, fc.constantFrom("as", "make", "to"), (name, prefix) => {
        const helper = `${prefix}${name}`;
        const constructor = `const ${helper} = (value: string): ${name} => value as ${name};`;
        const neutral = `const project = (value: string): ${name} => value as ${name};`;
        expect(lintOne(constructor, "agent-code-guard/no-manual-brand-constructor")).toHaveLength(1);
        expect(lintOne(neutral, "agent-code-guard/no-manual-brand-constructor")).toHaveLength(0);
      }),
      { numRuns: 40 },
    );
  });
});

describe("property: example-only tests", () => {
  it("example-only scopes fire once they cross the example threshold", () => {
    fc.assert(
      fc.property(testFunctionArb, fc.integer({ min: 2, max: 6 }), (testFn, count) => {
        const code = exampleTests(testFn, count).join("\n");
        const messages = lintTestFile(code, "agent-code-guard/no-example-only-tests");
        expect(messages).toHaveLength(1);
        expect(messages[0]?.message).toContain(`${count} example tests`);
      }),
      { numRuns: 30 },
    );
  });

  it("property evidence suppresses broad example scopes without relying on test titles", () => {
    fc.assert(
      fc.property(
        testFunctionArb,
        fc.integer({ min: 2, max: 6 }),
        propertyPatternArb,
        (testFn, count, propertyCode) => {
          const code = [...exampleTests(testFn, count), propertyCode].join("\n");
          expect(lintTestFile(code, "agent-code-guard/no-example-only-tests")).toHaveLength(0);
        },
      ),
      { numRuns: 30 },
    );
  });

  it("single regression tests and explicit regression-only files stay clean", () => {
    fc.assert(
      fc.property(testFunctionArb, (testFn) => {
        const single = exampleTests(testFn, 1).join("\n");
        const regressionOnly =
          "// @agent-code-guard/regression-only: reproduces a historical parser crash\n" +
          exampleTests(testFn, 3).join("\n");
        expect(lintTestFile(single, "agent-code-guard/no-example-only-tests")).toHaveLength(0);
        expect(lintTestFile(regressionOnly, "agent-code-guard/no-example-only-tests"))
          .toHaveLength(0);
      }),
      { numRuns: 10 },
    );
  });
});

function exampleTests(testFn: string, count: number): readonly string[] {
  return Array.from(
    { length: count },
    (_, index) => `${testFn}('case ${index}', () => { expect(${index}).toBe(${index}); });`,
  );
}
