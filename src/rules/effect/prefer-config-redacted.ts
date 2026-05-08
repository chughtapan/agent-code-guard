import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

const SECRET_NAME_RE =
  /(api[_-]?key|secret|token|password|passwd|credential|private[_-]?key|auth|client[_-]?secret|bearer|access[_-]?key)/i;

function isConfigStringCall(node: TSESTree.CallExpression): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  const callee = node.callee;
  if (callee.computed) return false;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (callee.object.name !== "Config") return false;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  return callee.property.name === "string";
}

function literalStringValue(node: TSESTree.Node): string | null {
  if (node.type !== AST_NODE_TYPES.Literal) return null;
  return typeof node.value === "string" ? node.value : null;
}

export default createRule({
  name: "prefer-config-redacted",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Config.string calls whose key name looks like a secret. Use Config.redacted so the value is never shown in logs or error messages.",
    },
    messages: {
      preferRedacted:
        "Config key `{{name}}` looks like a secret; use Config.redacted instead of Config.string so the value can't leak via logs or error formatting.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (!isConfigStringCall(node)) return;
        const first = node.arguments[0];
        if (first === undefined) return;
        const name = literalStringValue(first);
        if (name === null) return;
        if (!SECRET_NAME_RE.test(name)) return;
        context.report({
          node,
          messageId: "preferRedacted",
          data: { name },
        });
      },
    };
  },
});
