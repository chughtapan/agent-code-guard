/**
 * @file Documents the rules/vertical-organization/stepdown-model rule, helper, or integration surface.
 */

import type { TSESTree } from "@typescript-eslint/utils";

/** Function nodes that can own stepdown call edges. */
export type FunctionImplementation = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;
type Declaration = TSESTree.FunctionDeclaration | TSESTree.MethodDefinition;
/** AST containers whose implementations form independent ordering stories. */
export type Container = TSESTree.Program | TSESTree.ClassBody;

/** Describes one eligible function or method in its declaration-order band. */
export interface Implementation {
  readonly declaration: Declaration;
  readonly function: FunctionImplementation;
  readonly container: Container;
  readonly band: number;
  readonly bandName: string;
  readonly index: number;
  readonly label: string;
  readonly callableName: string | null;
  readonly isStatic: boolean;
}

/** Connects a local caller to its resolved callee at one call site. */
export interface Edge {
  readonly caller: Implementation;
  readonly callee: Implementation;
  readonly call: TSESTree.CallExpression;
}

/**
 * An edge that breaks component order. `cycleBlocker` names the cycle member
 * that follows the callee when the caller alone already precedes it, so the
 * diagnostic can state the constraint that is actually violated.
 */
export interface Violation {
  readonly edge: Edge;
  readonly cycleBlocker: Implementation | null;
}
