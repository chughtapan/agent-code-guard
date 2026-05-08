import * as fc from "fast-check";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { expect, it } from "vitest";
import {
  getEnclosingFunctionName,
  getFirst,
  getNumericLiteralValue,
  getParent,
  getStaticMemberPropertyName,
  getStaticStringKey,
  resolveStringLiteralValue,
  getTagAccess,
  isFunctionReturnTypeReference,
} from "./index.js";
import {
  allNodes,
  firstExpression,
  firstInitializer,
  firstObjectProperty,
  identArb,
  nonNegativeIntArb,
  parseWithParents,
  positiveIntArb,
  safeStringArb,
} from "./test-support/ast-refinement-fixtures.js";

it("Property 1: getFirst matches JS head semantics", () => {
  fc.assert(
    fc.property(fc.array(fc.integer(), { maxLength: 5 }), (values) => {
      expect(getFirst(values)).toBe(values[0] ?? null);
    }),
    { numRuns: 100 },
  );
});

it("Property 1a: getFirst collapses explicit undefined to null", () => {
  expect(getFirst([undefined])).toBeNull();
});

it("Property 2: getStaticStringKey accepts static object keys and rejects dynamic ones", () => {
  fc.assert(
    fc.property(identArb, safeStringArb, (ident, text) => {
      expectStaticObjectKeys(ident, text);
    }),
    { numRuns: 80 },
  );
});

it("Property 3: literal helpers preserve string and numeric shapes", () => {
  fc.assert(
    fc.property(safeStringArb, nonNegativeIntArb, positiveIntArb, (text, n, positive) => {
      expectLiteralHelpers(text, n, positive);
    }),
    { numRuns: 80 },
  );
});

it("Property 4: member-name helpers normalize plain and optional `_tag` access only", () => {
  fc.assert(
    fc.property(identArb, (target) => {
      expectTagAccessShapes(target);
    }),
    { numRuns: 60 },
  );
});

it("Property 5: getEnclosingFunctionName recovers supported container names", () => {
  fc.assert(
    fc.property(
      fc.record({
        fnName: identArb,
        localName: identArb,
        propName: identArb,
        quotedName: identArb,
        methodName: identArb,
      }),
      (names) => {
        const throws = throwStatements(functionContainerProgram(names));
        expect(throws.map((node) => getEnclosingFunctionName(node))).toEqual([
          names.fnName,
          names.localName,
          names.propName,
          names.quotedName,
          names.methodName,
          null,
        ]);
      },
    ),
    { numRuns: 30 },
  );
});

it("Property 6: Promise return-type detection only fires for function return positions", () => {
  fc.assert(
    fc.property(identArb, identArb, identArb, (fnName, methodName, aliasName) => {
      const refs = promiseRefs(`
        function ${fnName}(): Promise<number> { return Promise.resolve(1); }
        interface Box { ${methodName}(): Promise<number>; }
        type ${aliasName} = Promise<number>;
      `);
      expect(refs.map((node) => isFunctionReturnTypeReference(node))).toEqual([
        true,
        true,
        false,
      ]);
    }),
    { numRuns: 40 },
  );
});

it("Property 7: malformed empty template literals stay safely null", () => {
  const emptyTemplate = {
    type: AST_NODE_TYPES.TemplateLiteral,
    expressions: [],
    quasis: [],
  } as TSESTree.TemplateLiteral;

  expect(getStaticStringKey(emptyTemplate, true)).toBeNull();
  expect(resolveStringLiteralValue(emptyTemplate)).toBeNull();
});

it("Property 8: parent helpers return null at the top level and for computed owners", () => {
  const program = parseWithParents(`
    const obj = {
      [name]: () => { throw new Error("x"); },
    };
  `);
  const throws = throwStatements(program);

  expect(getParent(program)).toBeNull();
  expect(getEnclosingFunctionName(throws[0]!)).toBeNull();
});

it("getEnclosingFunctionName returns null for unsupported function containers", () => {
  const throws = throwStatements(parseWithParents(`
    const handlers = [() => { throw new Error("x"); }];
    let assigned;
    assigned = () => { throw new Error("y"); };
    function outer() {
      const nested = [() => { throw new Error("z"); }];
      return nested;
    }
  `));

  expect(throws.map((node) => getEnclosingFunctionName(node))).toEqual([null, null, null]);
});

it("member helpers reject non-member nodes and computed optional access", () => {
  expect(getStaticMemberPropertyName(firstExpression("run();"))).toBeNull();
  expect(getTagAccess(firstExpression('value?.["_tag"];'))).toBeNull();
});

it("isFunctionReturnTypeReference ignores non-return Promise annotations", () => {
  const refs = promiseRefs(`
    function run(input: Promise<number>): void { return; }
    const value: Promise<number> = Promise.resolve(1);
    type Box = { value: Promise<number> };
    type Loader = () => Promise<number>;
  `);

  expect(refs.map((node) => isFunctionReturnTypeReference(node))).toEqual([
    false,
    false,
    false,
    true,
  ]);
});

interface FunctionContainerNames {
  readonly fnName: string;
  readonly localName: string;
  readonly propName: string;
  readonly quotedName: string;
  readonly methodName: string;
}

function expectStaticObjectKeys(ident: string, text: string): void {
  const identProp = firstObjectProperty(`const obj = { ${ident}: 1 };`);
  expect(getStaticStringKey(identProp.key, identProp.computed)).toBe(ident);

  const quotedProp = firstObjectProperty(`const obj = { ${JSON.stringify(text)}: 1 };`);
  expect(getStaticStringKey(quotedProp.key, quotedProp.computed)).toBe(text);

  const templateProp = firstObjectProperty(`const obj = { [\`${text}\`]: 1 };`);
  expect(getStaticStringKey(templateProp.key, templateProp.computed)).toBe(text);

  const dynamicProp = firstObjectProperty(`const obj = { [${ident}]: 1 };`);
  expect(getStaticStringKey(dynamicProp.key, dynamicProp.computed)).toBeNull();

  const interpolatedTemplateProp = firstObjectProperty(
    "const obj = { [`" + text + "${" + ident + "}`]: 1 };",
  );
  expect(getStaticStringKey(interpolatedTemplateProp.key, interpolatedTemplateProp.computed))
    .toBeNull();
}

function expectLiteralHelpers(text: string, n: number, positive: number): void {
  expect(resolveStringLiteralValue(firstInitializer(`const value = ${JSON.stringify(text)};`)))
    .toBe(text);
  expect(resolveStringLiteralValue(firstInitializer(`const value = \`${text}\`;`))).toBe(text);
  expect(resolveStringLiteralValue(firstInitializer(`const value = \`${text}\${suffix}\`;`)))
    .toBeNull();
  expect(getNumericLiteralValue(firstInitializer(`const value = ${n};`))).toBe(n);
  expect(getNumericLiteralValue(firstInitializer(`const value = -${positive};`)))
    .toBe(-positive);
  expect(getNumericLiteralValue(firstInitializer(`const value = +${positive};`))).toBeNull();
}

function expectTagAccessShapes(target: string): void {
  const direct = firstExpression(`${target}._tag;`);
  expect(getStaticMemberPropertyName(direct)).toBe("_tag");
  expect(getTagAccess(direct)).not.toBeNull();

  const optional = firstExpression(`${target}?._tag;`);
  expect(getStaticMemberPropertyName(optional)).toBe("_tag");
  expect(getTagAccess(optional)).not.toBeNull();

  const computed = firstExpression(`${target}["_tag"];`);
  expect(getStaticMemberPropertyName(computed)).toBeNull();
  expect(getTagAccess(computed)).toBeNull();

  const other = firstExpression(`${target}.status;`);
  expect(getStaticMemberPropertyName(other)).toBe("status");
  expect(getTagAccess(other)).toBeNull();
}

function functionContainerProgram(names: FunctionContainerNames): TSESTree.Program {
  return parseWithParents(`
    function ${names.fnName}() { throw new Error("x"); }
    const ${names.localName} = () => { throw new Error("x"); };
    const obj = {
      ${names.propName}() { throw new Error("x"); },
      ${JSON.stringify(names.quotedName)}: () => { throw new Error("x"); },
    };
    class Box {
      ${names.methodName}() { throw new Error("x"); }
    }
    Promise.resolve().then(() => { throw new Error("x"); });
  `);
}

function throwStatements(program: TSESTree.Program): readonly TSESTree.ThrowStatement[] {
  return allNodes(
    program,
    (node): node is TSESTree.ThrowStatement => node.type === AST_NODE_TYPES.ThrowStatement,
  );
}

function promiseRefs(code: string): readonly TSESTree.TSTypeReference[] {
  return allNodes(
    parseWithParents(code),
    (node): node is TSESTree.TSTypeReference =>
      node.type === AST_NODE_TYPES.TSTypeReference &&
      node.typeName.type === AST_NODE_TYPES.Identifier &&
      node.typeName.name === "Promise",
  );
}
