import * as tsParser from "@typescript-eslint/parser";
import * as fc from "fast-check";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";

const RESERVED = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
  "false", "finally", "for", "function", "if", "import", "in", "instanceof",
  "let", "new", "null", "of", "return", "super", "switch", "this", "throw",
  "true", "try", "typeof", "var", "void", "while", "with", "yield",
]);

export const identArb = fc
  .stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/)
  .filter((name) => !RESERVED.has(name));
export const safeStringArb = fc.stringMatching(/^[a-z]{0,12}$/);
export const nonNegativeIntArb = fc.integer({ min: 0, max: 1000 });
export const positiveIntArb = fc.integer({ min: 1, max: 1000 });

export function parseWithParents(code: string): TSESTree.Program {
  const program = tsParser.parse(code, {
    ecmaVersion: 2022,
    sourceType: "module",
    range: true,
  }) as TSESTree.Program;
  attachParents(program);
  return program;
}

export function firstObjectProperty(code: string): TSESTree.Property {
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

export function firstInitializer(code: string): TSESTree.Expression {
  const program = parseWithParents(code);
  const statement = program.body[0];
  const init = statement?.type === AST_NODE_TYPES.VariableDeclaration
    ? statement.declarations[0]?.init
    : null;
  if (!init || init.type === AST_NODE_TYPES.SpreadElement) {
    throw new Error(`expected expression initializer in:\n${code}`);
  }
  return init;
}

export function firstExpression(code: string): TSESTree.Expression {
  const program = parseWithParents(code);
  const statement = program.body[0];
  if (statement?.type !== AST_NODE_TYPES.ExpressionStatement) {
    throw new Error(`expected expression statement in:\n${code}`);
  }
  return statement.expression;
}

export function allNodes<T extends TSESTree.Node>(
  node: TSESTree.Node,
  predicate: (candidate: TSESTree.Node) => candidate is T,
): T[] {
  const results: T[] = [];
  visit(node, (candidate) => {
    if (predicate(candidate)) results.push(candidate);
  });
  return results;
}

function attachParents(node: unknown): void {
  if (!isNode(node)) return;
  for (const child of childNodes(node)) attachParentTree(child, node);
}

function attachParentTree(node: unknown, parent: TSESTree.Node): void {
  if (!isNode(node)) return;
  assignParent(node, parent);
  for (const child of childNodes(node)) attachParentTree(child, node);
}

function assignParent(node: TSESTree.Node, parent: TSESTree.Node): void {
  (node as TSESTree.Node & { parent?: TSESTree.Node }).parent = parent;
}

function visit(node: TSESTree.Node, fn: (node: TSESTree.Node) => void): void {
  fn(node);
  for (const child of childNodes(node)) visit(child, fn);
}

function childNodes(node: TSESTree.Node): readonly TSESTree.Node[] {
  return Object.entries(node).flatMap(([key, value]) =>
    key === "parent" ? [] : nodesFromValue(value)
  );
}

function nodesFromValue(value: unknown): readonly TSESTree.Node[] {
  if (Array.isArray(value)) return value.filter(isNode);
  return isNode(value) ? [value] : [];
}

function isNode(value: unknown): value is TSESTree.Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}
