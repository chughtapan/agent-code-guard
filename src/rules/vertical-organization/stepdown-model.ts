import type { TSESTree } from "@typescript-eslint/utils";

export type FunctionImplementation = TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;
export type Declaration = TSESTree.FunctionDeclaration | TSESTree.MethodDefinition;
export type Container = TSESTree.Program | TSESTree.ClassBody;

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

export interface Edge {
  readonly caller: Implementation;
  readonly callee: Implementation;
  readonly call: TSESTree.CallExpression;
}
