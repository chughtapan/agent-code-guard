import * as tsParser from "@typescript-eslint/parser";
import * as fc from "fast-check";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { describe, expect, it } from "vitest";
import {
  getEnclosingFunctionName,
  getFirst,
  getNumericLiteralValue,
  getStaticMemberPropertyName,
  getStaticStringKey,
  getStringLiteralValue,
  getTagAccess,
  isFunctionReturnTypeReference,
} from "../../src/utils/ast-refinement.js";

const RESERVED = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
  "false", "finally", "for", "function", "if", "import", "in", "instanceof",
  "let", "new", "null", "of", "return", "super", "switch", "this", "throw",
  "true", "try", "typeof", "var", "void", "while", "with", "yield",
]);

const identArb = fc
  .stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/)
  .filter((name) => !RESERVED.has(name));

const safeStringArb = fc.stringMatching(/^[a-z]{0,12}$/);
const nonNegativeIntArb = fc.integer({ min: 0, max: 1000 });
const positiveIntArb = fc.integer({ min: 1, max: 1000 });

function parseWithParents(code: string): TSESTree.Program {
  const program = tsParser.parse(code, {
    ecmaVersion: 2022,
    sourceType: "module",
    range: true,
  }) as TSESTree.Program;
  attachParents(program, undefined);
  return program;
}

function attachParents(node: unknown, parent: TSESTree.Node | undefined): void {
  if (!isNode(node)) return;
  if (parent) {
    (node as TSESTree.Node & { parent?: TSESTree.Node }).parent = parent;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) {
      for (const child of value) {
        attachParents(child, node);
      }
      continue;
    }
    attachParents(value, node);
  }
}

function isNode(value: unknown): value is TSESTree.Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}

function firstObjectProperty(code: string): TSESTree.Property {
  const program = parseWithParents(code);
  const statement = program.body[0];
  if (
    statement?.type !== AST_NODE_TYPES.VariableDeclaration ||
    statement.declarations[0]?.init?.type !== AST_NODE_TYPES.ObjectExpression
  ) {
    throw new Error(`expected object literal snippet:\n${code}`);
  }
  const property = statement.declarations[0].init.properties[0];
  if (!property || property.type !== AST_NODE_TYPES.Property) {
    throw new Error(`expected first property in:\n${code}`);
  }
  return property;
}

function firstInitializer(code: string): TSESTree.Expression {
  const program = parseWithParents(code);
  const statement = program.body[0];
  const init =
    statement?.type === AST_NODE_TYPES.VariableDeclaration
      ? statement.declarations[0]?.init
      : null;
  if (!init || init.type === AST_NODE_TYPES.SpreadElement) {
    throw new Error(`expected expression initializer in:\n${code}`);
  }
  return init;
}

function firstExpression(code: string): TSESTree.Expression {
  const program = parseWithParents(code);
  const statement = program.body[0];
  if (statement?.type !== AST_NODE_TYPES.ExpressionStatement) {
    throw new Error(`expected expression statement in:\n${code}`);
  }
  return statement.expression;
}

function allNodes<T extends TSESTree.Node>(
  node: TSESTree.Node,
  predicate: (candidate: TSESTree.Node) => candidate is T,
): T[] {
  const results: T[] = [];
  visit(node, (candidate) => {
    if (predicate(candidate)) results.push(candidate);
  });
  return results;
}

function visit(node: TSESTree.Node, fn: (node: TSESTree.Node) => void): void {
  fn(node);
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) {
      for (const child of value) {
        if (isNode(child)) visit(child, fn);
      }
      continue;
    }
    if (isNode(value)) visit(value, fn);
  }
}

describe("property: ast refinement", () => {
  it("Property 1: getFirst matches JS head semantics", () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { maxLength: 5 }), (values) => {
        expect(getFirst(values)).toBe(values[0] ?? null);
      }),
      { numRuns: 100 },
    );
  });

  it("Property 2: getStaticStringKey accepts static object keys and rejects dynamic ones", () => {
    fc.assert(
      fc.property(identArb, safeStringArb, (ident, text) => {
        const identProp = firstObjectProperty(`const obj = { ${ident}: 1 };`);
        expect(getStaticStringKey(identProp.key, identProp.computed)).toBe(ident);

        const quotedProp = firstObjectProperty(
          `const obj = { ${JSON.stringify(text)}: 1 };`,
        );
        expect(getStaticStringKey(quotedProp.key, quotedProp.computed)).toBe(text);

        const templateProp = firstObjectProperty(`const obj = { [\`${text}\`]: 1 };`);
        expect(getStaticStringKey(templateProp.key, templateProp.computed)).toBe(text);

        const dynamicProp = firstObjectProperty(`const obj = { [${ident}]: 1 };`);
        expect(getStaticStringKey(dynamicProp.key, dynamicProp.computed)).toBeNull();
      }),
      { numRuns: 80 },
    );
  });

  it("Property 3: literal helpers preserve string and numeric shapes", () => {
    fc.assert(
      fc.property(safeStringArb, nonNegativeIntArb, positiveIntArb, (text, n, positive) => {
        expect(getStringLiteralValue(firstInitializer(`const value = ${JSON.stringify(text)};`))).toBe(text);
        expect(getStringLiteralValue(firstInitializer(`const value = \`${text}\`;`))).toBe(text);
        expect(getStringLiteralValue(firstInitializer(`const value = \`${text}\${suffix}\`;`))).toBeNull();

        expect(getNumericLiteralValue(firstInitializer(`const value = ${n};`))).toBe(n);
        expect(getNumericLiteralValue(firstInitializer(`const value = -${positive};`))).toBe(-positive);
        expect(getNumericLiteralValue(firstInitializer(`const value = +${positive};`))).toBeNull();
      }),
      { numRuns: 80 },
    );
  });

  it("Property 4: member-name helpers normalize plain and optional `_tag` access only", () => {
    fc.assert(
      fc.property(identArb, (target) => {
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
      }),
      { numRuns: 60 },
    );
  });

  it("Property 5: getEnclosingFunctionName recovers names from supported function containers", () => {
    fc.assert(
      fc.property(identArb, identArb, identArb, identArb, identArb, (fnName, localName, propName, quotedName, methodName) => {
        const program = parseWithParents(`
          function ${fnName}() { throw new Error("x"); }
          const ${localName} = () => { throw new Error("x"); };
          const obj = {
            ${propName}() { throw new Error("x"); },
            ${JSON.stringify(quotedName)}: () => { throw new Error("x"); },
          };
          class Box {
            ${methodName}() { throw new Error("x"); }
          }
          Promise.resolve().then(() => { throw new Error("x"); });
        `);

        const throws = allNodes(
          program,
          (node): node is TSESTree.ThrowStatement => node.type === AST_NODE_TYPES.ThrowStatement,
        );
        const names = throws.map((node) => getEnclosingFunctionName(node));
        expect(names).toEqual([
          fnName,
          localName,
          propName,
          quotedName,
          methodName,
          null,
        ]);
      }),
      { numRuns: 30 },
    );
  });

  it("Property 6: Promise return-type detection only fires for function return positions", () => {
    fc.assert(
      fc.property(identArb, identArb, identArb, (fnName, methodName, aliasName) => {
        const program = parseWithParents(`
          function ${fnName}(): Promise<number> { return Promise.resolve(1); }
          interface Box { ${methodName}(): Promise<number>; }
          type ${aliasName} = Promise<number>;
        `);
        const refs = allNodes(
          program,
          (node): node is TSESTree.TSTypeReference =>
            node.type === AST_NODE_TYPES.TSTypeReference &&
            node.typeName.type === AST_NODE_TYPES.Identifier &&
            node.typeName.name === "Promise",
        );
        expect(refs.map((node) => isFunctionReturnTypeReference(node))).toEqual([
          true,
          true,
          false,
        ]);
      }),
      { numRuns: 40 },
    );
  });
});
