import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import * as tsParser from "@typescript-eslint/parser";
import { expect, test } from "vitest";
import { preferStepdownFunctionOrder as rule } from "./prefer-stepdown-function-order.js";
import type { Edge, Implementation } from "./stepdown-model.js";
import { violatingEdges } from "./stepdown-scc.js";
import { stepdownRuleTester } from "./test-support/stepdown.js";

const LINEAR_CHAIN_LENGTH = 8_000;
const ruleTester = stepdownRuleTester();
const syntheticProgram = tsParser.parse("function synthetic() { return syntheticCall(); }");
const syntheticDeclaration = syntheticProgram.body[0];
if (syntheticDeclaration?.type !== AST_NODE_TYPES.FunctionDeclaration) {
  throw new Error("Expected the synthetic fixture to contain one function declaration.");
}
const syntheticStatement = syntheticDeclaration.body.body[0];
if (syntheticStatement?.type !== AST_NODE_TYPES.ReturnStatement || syntheticStatement.argument?.type !== AST_NODE_TYPES.CallExpression) {
  throw new Error("Expected the synthetic fixture to contain one call expression.");
}
const syntheticCall = syntheticStatement.argument;

test("an ordered eight-thousand-vertex graph does not exhaust the call stack", () => {
  const implementations: Implementation[] = [];
  const edges: Edge[] = [];
  for (let index = 0; index < LINEAR_CHAIN_LENGTH; index += 1) {
    implementations.push(implementation(index));
    if (index > 0) {
      edges.push({ caller: implementations[index - 1], callee: implementations[index], call: syntheticCall });
    }
  }

  expect(violatingEdges(edges)).toEqual([]);
});

function implementation(index: number): Implementation {
  return {
    declaration: syntheticDeclaration,
    function: syntheticDeclaration,
    container: syntheticProgram,
    band: 1,
    bandName: "internal",
    index,
    label: `step${index}`,
    callableName: `step${index}`,
    isStatic: false,
  };
}

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
