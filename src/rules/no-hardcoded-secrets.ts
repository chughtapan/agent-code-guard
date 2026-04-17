import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const SECRET_KEY_NAMES = /^(api[_-]?key|secret|token|password|auth[_-]?token)$/i;
const PLACEHOLDER_VALUES =
  /^(test|fake|dummy|placeholder|example|sample|mock|xxx+|\.{3,}|your[-_].*)$/i;

function isSuspiciousSecretValue(value: string): boolean {
  if (value.length < 20) return false;
  if (PLACEHOLDER_VALUES.test(value)) return false;
  return /[a-zA-Z0-9_-]{20,}/.test(value);
}

function keyName(
  key: TSESTree.Expression | TSESTree.PrivateIdentifier,
): string | null {
  if (key.type === AST_NODE_TYPES.Identifier) return key.name;
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === "string") {
    return key.value;
  }
  return null;
}

export default createRule({
  name: "no-hardcoded-secrets",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag hardcoded secret-looking string literals assigned to names like apiKey, token, secret, password. Use environment variables instead.",
    },
    messages: {
      hardcodedSecret:
        "Hardcoded {{field}} literal — use process.env.* (or your config loader) instead",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function checkLiteralFor(
      field: string,
      valueNode: TSESTree.Node,
      reportNode: TSESTree.Node,
    ) {
      if (
        valueNode.type !== AST_NODE_TYPES.Literal ||
        typeof valueNode.value !== "string"
      ) {
        return;
      }
      if (!isSuspiciousSecretValue(valueNode.value)) return;
      context.report({
        node: reportNode,
        messageId: "hardcodedSecret",
        data: { field },
      });
    }

    return {
      Property(node) {
        const name = keyName(node.key);
        if (!name || !SECRET_KEY_NAMES.test(name)) return;
        checkLiteralFor(name, node.value, node);
      },
      VariableDeclarator(node) {
        if (node.id.type !== AST_NODE_TYPES.Identifier) return;
        if (!SECRET_KEY_NAMES.test(node.id.name)) return;
        if (!node.init) return;
        checkLiteralFor(node.id.name, node.init, node);
      },
      AssignmentExpression(node) {
        const left = node.left;
        let field: string | null = null;
        if (left.type === AST_NODE_TYPES.Identifier) field = left.name;
        else if (
          left.type === AST_NODE_TYPES.MemberExpression &&
          !left.computed &&
          left.property.type === AST_NODE_TYPES.Identifier
        ) {
          field = left.property.name;
        }
        if (!field || !SECRET_KEY_NAMES.test(field)) return;
        checkLiteralFor(field, node.right, node);
      },
    };
  },
});
