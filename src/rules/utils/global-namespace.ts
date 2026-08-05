/**
 * @file Resolves direct and globalThis-qualified JavaScript namespace
 * references without mistaking shadowed locals for builtins.
 */

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import {
  getStaticStringKey,
  resolveStringLiteralValue,
} from "./ast-refinement/index.js";
import { isUnshadowedGlobal } from "./unshadowed-global.js";

/** A statically resolved builtin namespace and its global root identifier. */
interface GlobalNamespaceReference {
  readonly globalIdentifier: TSESTree.Identifier;
  readonly name: string;
}

/** A statically resolved method on a builtin namespace. */
export interface GlobalStaticCallReference {
  readonly method: string;
  readonly owner: string;
}

/**
 * Resolves direct, namespace-aliased, method-aliased, and destructured calls
 * on unshadowed builtin namespaces.
 * @param sourceCode Scope information for shadowing checks.
 * @param node Possible static method callee.
 * @param names Builtin namespace names accepted by the caller.
 * @returns The resolved owner and method, or `null` for dynamic/local values.
 */
export function getUnshadowedGlobalStaticCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  names: ReadonlySet<string>,
): GlobalStaticCallReference | null {
  return resolvedStaticCall(sourceCode, node, names, new Set());
}

function resolvedStaticCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  names: ReadonlySet<string>,
  seen: ReadonlySet<string>,
): GlobalStaticCallReference | null {
  const unwrapped = unwrapExpression(node);
  if (unwrapped.type === AST_NODE_TYPES.MemberExpression) {
    return memberStaticCall(sourceCode, unwrapped, names);
  }
  if (unwrapped.type !== AST_NODE_TYPES.Identifier) {
    return null;
  }
  return resolvedIdentifierStaticCall(sourceCode, unwrapped, names, seen);
}

function resolvedIdentifierStaticCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
  names: ReadonlySet<string>,
  seen: ReadonlySet<string>,
): GlobalStaticCallReference | null {
  if (seen.has(identifier.name)) {
    return null;
  }
  const destructured = destructuredMethod(sourceCode, identifier, names);
  if (destructured !== null) {
    return destructured;
  }
  const initializer = directAliasInitializer(sourceCode, identifier);
  if (initializer === null) {
    return null;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(identifier.name);
  return resolvedStaticCall(sourceCode, initializer, names, nextSeen);
}

function memberStaticCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.MemberExpression,
  names: ReadonlySet<string>,
): GlobalStaticCallReference | null {
  const namespace = resolvedNamespace(sourceCode, node.object, names, new Set());
  const method = staticMemberName(sourceCode, node);
  return namespace === null || method === null
    ? null
    : { method, owner: namespace.name };
}

function destructuredMethod(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
  names: ReadonlySet<string>,
): GlobalStaticCallReference | null {
  const definition = constVariableDefinition(sourceCode, identifier);
  if (
    definition === null ||
    definition.node.id.type !== AST_NODE_TYPES.ObjectPattern ||
    definition.node.init === null
  ) {
    return null;
  }
  const property = matchingIdentifierProperty(definition.node.id, identifier.name);
  if (property === null) {
    return null;
  }
  const namespace = resolvedNamespace(sourceCode, definition.node.init, names, new Set());
  const method = destructuredStaticMethodName(sourceCode, property);
  return namespace === null || method === null
    ? null
    : { method, owner: namespace.name };
}

function directAliasInitializer(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
): TSESTree.Expression | null {
  const definition = constVariableDefinition(sourceCode, identifier);
  if (
    definition === null ||
    definition.node.id.type !== AST_NODE_TYPES.Identifier
  ) {
    return null;
  }
  return definition.node.init;
}

function resolvedNamespace(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  names: ReadonlySet<string>,
  seen: ReadonlySet<string>,
): GlobalNamespaceReference | null {
  const unwrapped = unwrapExpression(node);
  const direct =
    directNamespace(sourceCode, unwrapped, names) ??
    globalThisNamespace(sourceCode, unwrapped, names);
  if (direct !== null || unwrapped.type !== AST_NODE_TYPES.Identifier) {
    return direct;
  }
  if (seen.has(unwrapped.name)) {
    return null;
  }
  const definition = constVariableDefinition(sourceCode, unwrapped);
  if (
    definition === null ||
    definition.node.id.type !== AST_NODE_TYPES.Identifier ||
    definition.node.init === null
  ) {
    return null;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(unwrapped.name);
  return resolvedNamespace(sourceCode, definition.node.init, names, nextSeen);
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
  const name = staticMemberName(sourceCode, node);
  return name !== null && names.has(name)
    ? { globalIdentifier: node.object, name }
    : null;
}

function destructuredStaticMethodName(
  sourceCode: Readonly<TSESLint.SourceCode>,
  property: TSESTree.Property,
): string | null {
  const direct = getStaticStringKey(property.key, property.computed);
  if (direct !== null || !property.computed) {
    return direct;
  }
  return resolvedStaticString(sourceCode, property.key, new Set());
}

function staticMemberName(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.MemberExpression,
): string | null {
  const direct = getStaticStringKey(node.property, node.computed);
  if (direct !== null || !node.computed) {
    return direct;
  }
  return resolvedStaticString(sourceCode, node.property, new Set());
}

function resolvedStaticString(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  seen: ReadonlySet<string>,
): string | null {
  const unwrapped = unwrapExpression(node);
  const direct = resolveStringLiteralValue(unwrapped);
  if (direct !== null || unwrapped.type !== AST_NODE_TYPES.Identifier) {
    return direct;
  }
  if (seen.has(unwrapped.name)) {
    return null;
  }
  const definition = constVariableDefinition(sourceCode, unwrapped);
  if (definition === null || definition.node.init === null) {
    return null;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(unwrapped.name);
  return resolvedStaticString(sourceCode, definition.node.init, nextSeen);
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

function matchingIdentifierProperty(
  pattern: TSESTree.ObjectPattern,
  name: string,
): TSESTree.Property | null {
  for (const candidate of pattern.properties) {
    if (
      candidate.type === AST_NODE_TYPES.Property &&
      candidate.value.type === AST_NODE_TYPES.Identifier &&
      candidate.value.name === name
    ) {
      return candidate;
    }
  }
  return null;
}

function unwrapExpression(node: TSESTree.Expression): TSESTree.Expression {
  if (
    node.type === AST_NODE_TYPES.TSAsExpression ||
    node.type === AST_NODE_TYPES.TSTypeAssertion ||
    node.type === AST_NODE_TYPES.TSNonNullExpression
  ) {
    return unwrapExpression(node.expression);
  }
  return node;
}

function constVariableDefinition(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
) {
  let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) {
      const [definition] = variable.defs;
      return variable.defs.length === 1 &&
        definition?.type === "Variable" &&
        definition.parent.kind === "const"
        ? definition
        : null;
    }
    scope = scope.upper;
  }
  return null;
}
