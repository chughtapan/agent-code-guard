import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { PRINCIPLE_URL } from "../../utils/principles.js";

const SCHEMA_TYPE_PATHS: readonly (readonly string[])[] = [
  ["Schema", "Schema", "Type"],
  ["Schema", "Schema", "Encoded"],
  ["Schema", "Type"],
  ["Schema", "Encoded"],
];

function matchesQualifiedName(
  node: TSESTree.EntityName,
  parts: readonly string[],
): boolean {
  if (parts.length === 0) return false;
  if (parts.length === 1) {
    return (
      node.type === AST_NODE_TYPES.Identifier &&
      node.name === parts[0]
    );
  }
  if (node.type !== AST_NODE_TYPES.TSQualifiedName) return false;
  const last = parts[parts.length - 1];
  if (node.right.type !== AST_NODE_TYPES.Identifier) return false;
  if (node.right.name !== last) return false;
  return matchesQualifiedName(node.left, parts.slice(0, -1));
}

function isSchemaTypeReference(annotation: TSESTree.TypeNode): boolean {
  if (annotation.type !== AST_NODE_TYPES.TSTypeReference) return false;
  return SCHEMA_TYPE_PATHS.some((path) => matchesQualifiedName(annotation.typeName, path));
}

export default createRule({
  name: "no-schema-type-cast",
  meta: {
    type: "problem",
    docs: {
      description: "`Schema.Type` / `Schema.Encoded` casts assert the decoded shape without running the decode; the schema is the runtime path, not a type-only annotation.",
      url: PRINCIPLE_URL.VALIDATE_AT_BOUNDARY,
    },
    messages: {
      schemaTypeCast:
        "Bare cast to Schema.Schema.Type / Schema.Schema.Encoded; decode through the schema (Schema.decodeUnknownSync, decodeEither, decode) instead.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      TSAsExpression(node) {
        if (!isSchemaTypeReference(node.typeAnnotation)) return;
        context.report({ node, messageId: "schemaTypeCast" });
      },
    };
  },
});
