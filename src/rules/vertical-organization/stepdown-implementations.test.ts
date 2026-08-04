import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import * as tsParser from "@typescript-eslint/parser";
import { expect, test } from "vitest";
import { collectImplementations } from "./stepdown-implementations.js";

test("implementation model records non-static functions and non-callable constructors", () => {
  const program = tsParser.parse(`
    function topLevel() { return "value"; }
    class Service { constructor() {} }
  `);
  attachParents(program, null);
  const classBody = findClassBody(program);

  expect(collectImplementations(program, [classBody])).toMatchObject([
    { callableName: "topLevel", isStatic: false, bandName: "internal" },
    { callableName: null, isStatic: false, bandName: "constructor", label: "constructor" },
  ]);
});

function attachParents(node: TSESTree.Node, parent: TSESTree.Node | null): void {
  Object.assign(node, { parent });
  for (const child of childNodes(node)) {
    attachParents(child, node);
  }
}

function childNodes(node: TSESTree.Node): TSESTree.Node[] {
  return Object.entries(node)
    .filter(([key]) => key !== "parent")
    .flatMap(([, value]) => nodesIn(value));
}

function nodesIn(value: unknown): TSESTree.Node[] {
  if (Array.isArray(value)) {
    return value.filter(isNode);
  }
  return isNode(value) ? [value] : [];
}

function isNode(value: unknown): value is TSESTree.Node {
  return typeof value === "object" && value !== null && "type" in value && "range" in value;
}

function findClassBody(program: TSESTree.Program): TSESTree.ClassBody {
  const declaration = program.body.find(({ type }) => type === AST_NODE_TYPES.ClassDeclaration);
  if (declaration?.type !== AST_NODE_TYPES.ClassDeclaration) {
    throw new Error("Expected the fixture to contain a class declaration.");
  }
  return declaration.body;
}
