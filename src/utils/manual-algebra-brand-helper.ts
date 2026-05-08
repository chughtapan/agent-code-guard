import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";

const BRAND_HELPER_RE = /^(as|make|to)[A-Z]/;

type FunctionInitializer =
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function getBrandHelperCastName(node: TSESTree.Node): string | null {
  const expression = getBrandHelperExpression(node);
  return expression === null ? null : getCastAnnotationName(expression);
}

export interface ManualBrandConstructorMatch {
  readonly node: TSESTree.Node;
  readonly displayName: string;
  readonly targetType: string;
}

export function findManualBrandConstructorMatch(
  node: TSESTree.Node,
): ManualBrandConstructorMatch | null {
  const displayName = getBrandHelperDisplayName(node);
  const targetType = getBrandHelperCastName(node);
  if (displayName === null || targetType === null) return null;
  if (!matchesBrandHelperName(displayName, targetType)) return null;
  return { displayName, node, targetType };
}

function matchesBrandHelperName(
  displayName: string,
  targetType: string,
): boolean {
  return displayName === targetType || BRAND_HELPER_RE.test(displayName);
}

function getBrandHelperExpression(node: TSESTree.Node): TSESTree.Expression | null {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
    return getFunctionDeclarationExpression(node);
  }
  if (node.type !== AST_NODE_TYPES.VariableDeclarator) return null;
  return getVariableFunctionExpression(node);
}

function getFunctionDeclarationExpression(
  node: TSESTree.FunctionDeclaration,
): TSESTree.Expression | null {
  if (!node.body) return null;
  return getSingleReturnedExpression(node.body.body);
}

function getVariableFunctionExpression(
  node: TSESTree.VariableDeclarator,
): TSESTree.Expression | null {
  const fn = resolveFunctionInitializer(node.init);
  if (fn === null) return null;
  return getFunctionBodyExpression(fn);
}

function getBrandHelperDisplayName(node: TSESTree.Node): string | null {
  if (node.type === AST_NODE_TYPES.FunctionDeclaration) {
    return node.id?.name ?? null;
  }
  if (node.type !== AST_NODE_TYPES.VariableDeclarator) return null;
  return node.id.type === AST_NODE_TYPES.Identifier ? node.id.name : null;
}

function resolveFunctionInitializer(
  init: TSESTree.Expression | null,
): FunctionInitializer | null {
  if (init?.type === AST_NODE_TYPES.FunctionExpression) return init;
  if (init?.type === AST_NODE_TYPES.ArrowFunctionExpression) return init;
  return null;
}

function getFunctionBodyExpression(
  fn: FunctionInitializer,
): TSESTree.Expression | null {
  if (fn.body.type !== AST_NODE_TYPES.BlockStatement) return fn.body;
  return getSingleReturnedExpression(fn.body.body);
}

function getSingleReturnedExpression(
  statements: readonly TSESTree.Statement[],
): TSESTree.Expression | null {
  if (statements.length !== 1) return null;
  const statement = statements[0]!;
  if (statement.type !== AST_NODE_TYPES.ReturnStatement) return null;
  return statement.argument ?? null;
}

function getCastAnnotationName(expression: TSESTree.Expression): string | null {
  if (expression.type !== AST_NODE_TYPES.TSAsExpression) return null;
  const annotation = expression.typeAnnotation;
  if (annotation.type !== AST_NODE_TYPES.TSTypeReference) return null;
  const typeName = annotation.typeName;
  return typeName.type === AST_NODE_TYPES.Identifier ? typeName.name : null;
}
