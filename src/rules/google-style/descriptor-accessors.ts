/**
 * @file Rejects descriptor-defined accessors in favor of language syntax.
 */

import { type TSESLint, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { getStaticStringKey } from "../utils/ast-refinement/index.js";
import { getUnshadowedGlobalStaticCall } from "../utils/global-namespace.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

type DescriptorDefinitionKind = "bulk" | "single";

const DESCRIPTOR_NAMESPACES: ReadonlySet<string> = new Set(["Object", "Reflect"]);

function descriptorStaticCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
) {
  return getUnshadowedGlobalStaticCall(
    sourceCode,
    node.callee,
    DESCRIPTOR_NAMESPACES,
  );
}

function descriptorDefinitionKind(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
): DescriptorDefinitionKind | null {
  const call = descriptorStaticCall(sourceCode, node);
  if (call === null) {
    return null;
  }
  if (call.owner === "Object" && call.method === "defineProperties") {
    return "bulk";
  }
  if (
    (call.owner === "Object" || call.owner === "Reflect") &&
    call.method === "defineProperty"
  ) {
    return "single";
  }
  return null;
}

function constInitializer(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
): TSESTree.Expression | null {
  let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) {
      const [definition] = variable.defs;
      return variable.defs.length === 1 &&
        definition?.type === "Variable" &&
        definition.parent.kind === "const"
        ? definition.node.init
        : null;
    }
    scope = scope.upper;
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

function resolveConstExpression(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Expression,
  seen: ReadonlySet<string>,
): TSESTree.Expression | null {
  const unwrapped = unwrapExpression(node);
  if (unwrapped.type !== AST_NODE_TYPES.Identifier) {
    return unwrapped;
  }
  if (seen.has(unwrapped.name)) {
    return null;
  }
  const initializer = constInitializer(sourceCode, unwrapped);
  if (initializer === null) {
    return null;
  }
  const nextSeen = new Set(seen);
  nextSeen.add(unwrapped.name);
  return resolveConstExpression(sourceCode, initializer, nextSeen);
}

function isTypeAssertionExpression(
  node: TSESTree.Node,
): node is TSESTree.TSAsExpression | TSESTree.TSTypeAssertion | TSESTree.TSNonNullExpression {
  return node.type === AST_NODE_TYPES.TSAsExpression ||
    node.type === AST_NODE_TYPES.TSTypeAssertion ||
    node.type === AST_NODE_TYPES.TSNonNullExpression;
}

function aliasExpression(node: TSESTree.Node): TSESTree.Expression | null {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node;
  }
  return isTypeAssertionExpression(node) ? node : null;
}

function resolveObjectExpression(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Node,
): TSESTree.ObjectExpression | null {
  if (node.type === AST_NODE_TYPES.ObjectExpression) {
    return node;
  }
  const alias = aliasExpression(node);
  if (alias === null) {
    return null;
  }
  const resolved = resolveConstExpression(sourceCode, alias, new Set());
  return resolved?.type === AST_NODE_TYPES.ObjectExpression ? resolved : null;
}

function staticPropertyName(
  sourceCode: Readonly<TSESLint.SourceCode>,
  property: TSESTree.Property,
): string | null {
  const direct = getStaticStringKey(property.key, property.computed);
  if (direct !== null) {
    return direct;
  }
  if (
    property.computed &&
    property.key.type === AST_NODE_TYPES.Identifier
  ) {
    const resolved = resolveConstExpression(sourceCode, property.key, new Set());
    return resolved?.type === AST_NODE_TYPES.Literal &&
      typeof resolved.value === "string"
      ? resolved.value
      : null;
  }
  return null;
}

function isAccessorProperty(
  sourceCode: Readonly<TSESLint.SourceCode>,
  property: TSESTree.ObjectLiteralElement,
): boolean {
  if (property.type !== AST_NODE_TYPES.Property) {
    return false;
  }
  const name = staticPropertyName(sourceCode, property);
  return name === "get" || name === "set";
}

function objectHasAccessorDescriptor(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Node | null,
): boolean {
  if (node === null) {
    return false;
  }
  const resolved = resolveObjectExpression(sourceCode, node);
  if (resolved === null) {
    return false;
  }
  return resolved.properties.some((property) =>
    property.type === AST_NODE_TYPES.SpreadElement
      ? objectHasAccessorDescriptor(sourceCode, property.argument)
      : isAccessorProperty(sourceCode, property)
  );
}

function bulkDescriptorMapHasAccessor(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.Node | null,
): boolean {
  if (node === null) {
    return false;
  }
  const resolved = resolveObjectExpression(sourceCode, node);
  if (resolved === null) {
    return false;
  }
  return resolved.properties.some(
    (property) =>
      property.type === AST_NODE_TYPES.SpreadElement
        ? bulkDescriptorMapHasAccessor(sourceCode, property.argument)
        : objectHasAccessorDescriptor(sourceCode, property.value),
  );
}

function callDefinesAccessor(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
): boolean {
  const kind = descriptorDefinitionKind(sourceCode, node);
  if (kind === "single") {
    const descriptor = node.arguments[2];
    return descriptor?.type !== AST_NODE_TYPES.SpreadElement &&
      objectHasAccessorDescriptor(sourceCode, descriptor);
  }
  if (kind === "bulk") {
    const descriptorMap = node.arguments[1];
    return descriptorMap?.type !== AST_NODE_TYPES.SpreadElement &&
      bulkDescriptorMapHasAccessor(sourceCode, descriptorMap);
  }
  return false;
}

/**
 * Rejects descriptor accessors defined through Object or Reflect APIs.
 */
export const noDefinePropertyAccessors = createRule({
  name: "no-define-property-accessors",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Language-level accessors are visible to TypeScript and readers; descriptor accessors hide the class contract.",
      url: PRINCIPLE_URL.TYPES_BEAT_TESTS,
    },
    messages: {
      descriptorAccessor:
        "Declare getters and setters with language syntax instead of Object or Reflect property descriptors.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      CallExpression(node) {
        if (callDefinesAccessor(sourceCode, node)) {
          context.report({ node, messageId: "descriptorAccessor" });
        }
      },
    };
  },
});
