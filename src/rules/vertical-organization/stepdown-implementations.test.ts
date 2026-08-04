import type { TSESTree } from "@typescript-eslint/utils";
import * as tsParser from "@typescript-eslint/parser";
import { expect, test } from "vitest";
import { collectImplementations } from "./stepdown-implementations.js";

test("implementation model records non-static functions and non-callable constructors", () => {
  const program = tsParser.parse(`
    function topLevel() { return "value"; }
    class Service { constructor() {} }
  `) as TSESTree.Program;
  attachParents(program, null);
  const classBody = (program.body[1] as TSESTree.ClassDeclaration).body;

  expect(collectImplementations(program, [classBody])).toMatchObject([
    { callableName: "topLevel", isStatic: false, bandName: "internal" },
    { callableName: null, isStatic: false, bandName: "constructor", label: "constructor" },
  ]);
});

function attachParents(node: TSESTree.Node, parent: TSESTree.Node | null): void {
  (node as { parent: TSESTree.Node | null }).parent = parent;
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        if (isNode(child)) {
          attachParents(child, node);
        }
      }
    } else if (isNode(value)) {
      attachParents(value, node);
    }
  }
}

function isNode(value: unknown): value is TSESTree.Node {
  return typeof value === "object" && value !== null && "type" in value && "range" in value;
}
