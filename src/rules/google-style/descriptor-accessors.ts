/**
 * @file Rejects descriptor-defined accessors in favor of language syntax.
 */

import { type TSESLint, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import { isUnshadowedGlobal } from "../utils/unshadowed-global.js";

type DescriptorDefinitionKind = "bulk" | "single";

interface StaticCall {
  readonly method: string;
  readonly owner: TSESTree.Identifier;
}

function staticMemberName(node: TSESTree.MemberExpression): string | null {
  if (node.property.type === AST_NODE_TYPES.Identifier && !node.computed) {
    return node.property.name;
  }
  if (
    node.property.type === AST_NODE_TYPES.Literal &&
    typeof node.property.value === "string"
  ) {
    return node.property.value;
  }
  return null;
}

function staticCall(node: TSESTree.CallExpression): StaticCall | null {
  if (
    node.callee.type !== AST_NODE_TYPES.MemberExpression ||
    node.callee.object.type !== AST_NODE_TYPES.Identifier
  ) {
    return null;
  }
  const method = staticMemberName(node.callee);
  return method === null ? null : { method, owner: node.callee.object };
}

function descriptorDefinitionKind(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
): DescriptorDefinitionKind | null {
  const call = staticCall(node);
  if (call === null || !isUnshadowedGlobal(sourceCode, call.owner)) {
    return null;
  }
  if (call.owner.name === "Object" && call.method === "defineProperties") {
    return "bulk";
  }
  if (
    (call.owner.name === "Object" || call.owner.name === "Reflect") &&
    call.method === "defineProperty"
  ) {
    return "single";
  }
  return null;
}

function staticPropertyName(property: TSESTree.Property): string | null {
  if (property.key.type === AST_NODE_TYPES.Identifier) {
    return property.key.name;
  }
  if (
    property.key.type === AST_NODE_TYPES.Literal &&
    typeof property.key.value === "string"
  ) {
    return property.key.value;
  }
  return null;
}

function isAccessorProperty(property: TSESTree.ObjectLiteralElement): boolean {
  if (property.type !== AST_NODE_TYPES.Property) {
    return false;
  }
  const name = staticPropertyName(property);
  return name === "get" || name === "set";
}

function objectHasAccessorDescriptor(node: TSESTree.Node | null): boolean {
  return (
    node?.type === AST_NODE_TYPES.ObjectExpression &&
    node.properties.some(isAccessorProperty)
  );
}

function bulkDescriptorMapHasAccessor(node: TSESTree.Node | null): boolean {
  if (node?.type !== AST_NODE_TYPES.ObjectExpression) {
    return false;
  }
  return node.properties.some(
    (property) =>
      property.type === AST_NODE_TYPES.Property &&
      objectHasAccessorDescriptor(property.value),
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
      objectHasAccessorDescriptor(descriptor);
  }
  if (kind === "bulk") {
    const descriptorMap = node.arguments[1];
    return descriptorMap?.type !== AST_NODE_TYPES.SpreadElement &&
      bulkDescriptorMapHasAccessor(descriptorMap);
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
