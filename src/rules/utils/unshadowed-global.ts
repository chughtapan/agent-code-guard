/**
 * @file Scope-aware recognition for JavaScript global identifiers.
 */

import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

interface ScopeLookup {
  getScope(node: TSESTree.Node): TSESLint.Scope.Scope;
}

/**
 * Tests whether an identifier resolves to an unshadowed JavaScript global.
 * @param sourceCode The current file's scope manager.
 * @param identifier The identifier that names the possible global.
 * @returns Whether no local declaration shadows the identifier.
 */
export function isUnshadowedGlobal(
  sourceCode: ScopeLookup,
  identifier: TSESTree.Identifier,
): boolean {
  let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) {
      return variable.defs.length === 0;
    }
    scope = scope.upper;
  }
  return true;
}
