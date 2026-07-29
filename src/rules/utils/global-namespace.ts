/**
 * @file Resolves direct and globalThis-qualified JavaScript namespace
 * references without mistaking shadowed locals for builtins.
 */

import { type TSESLint, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { getStaticStringKey } from "./ast-refinement/index.js";
import { isUnshadowedGlobal } from "./unshadowed-global.js";

/** A statically resolved builtin namespace and its global root identifier. */
export interface GlobalNamespaceReference {
  readonly globalIdentifier: TSESTree.Identifier;
  readonly name: string;
}

function directNamespace(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  names: ReadonlySet<string>,
): GlobalNamespaceReference | null {
  if (node.type !== AST_NODE_TYPES.Identifier || !names.has(node.name)) {
    return null;
  }
  return isUnshadowedGlobal(sourceCode, node)
    ? { globalIdentifier: node, name: node.name }
    : null;
}

function globalThisNamespace(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  names: ReadonlySet<string>,
): GlobalNamespaceReference | null {
  if (
    node.type !== AST_NODE_TYPES.MemberExpression ||
    node.object.type !== AST_NODE_TYPES.Identifier ||
    node.object.name !== "globalThis"
  ) {
    return null;
  }
  if (!isUnshadowedGlobal(sourceCode, node.object)) {
    return null;
  }
  const name = getStaticStringKey(node.property, node.computed);
  return name !== null && names.has(name)
    ? { globalIdentifier: node.object, name }
    : null;
}

/**
 * Resolves `Object` and `globalThis.Object`-shaped namespace references.
 * @param sourceCode Scope information for shadowing checks.
 * @param node Possible namespace expression.
 * @param names Builtin namespace names accepted by the caller.
 * @returns The resolved namespace or `null` for dynamic and shadowed values.
 */
export function getUnshadowedGlobalNamespace(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  names: ReadonlySet<string>,
): GlobalNamespaceReference | null {
  return (
    directNamespace(sourceCode, node, names) ??
    globalThisNamespace(sourceCode, node, names)
  );
}
