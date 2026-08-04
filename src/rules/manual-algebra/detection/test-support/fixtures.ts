/**
 * @file Provides source fixtures shared by manual-algebra detection rule tests.
 */

import * as tsParser from "@typescript-eslint/parser";
import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";

/**
 * Parses the first declaration-like subject from a TypeScript fixture.
 * @param code The fixture source.
 * @returns The first declarator or top-level statement.
 */
export function parseSubject(code: string): TSESTree.Node {
  const program = tsParser.parse(code, {
    ecmaVersion: 2022,
    sourceType: "module",
  });
  const statement = program.body[0];
  if (!statement) {
    throw new Error(`expected a top-level statement in:\n${code}`);
  }
  if (statement.type === AST_NODE_TYPES.VariableDeclaration) {
    const declarator = statement.declarations[0];
    if (!declarator) {
      throw new Error(`expected a variable declarator in:\n${code}`);
    }
    return declarator;
  }
  return statement;
}
