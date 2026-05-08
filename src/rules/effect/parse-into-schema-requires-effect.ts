import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

const SCHEMA_DECODE_METHODS = new Set([
  "decodeUnknownSync",
  "decodeSync",
  "decodeUnknown",
  "decode",
  "decodeUnknownEither",
  "decodeEither",
]);

function isSchemaDecodeCall(node: TSESTree.CallExpression): string | null {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  const callee = node.callee;
  if (callee.computed) return null;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return null;
  if (callee.object.name !== "Schema") return null;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return null;
  if (!SCHEMA_DECODE_METHODS.has(callee.property.name)) return null;
  return callee.property.name;
}

function isJsonParseCall(node: TSESTree.Node): boolean {
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const callee = node.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  if (callee.computed) return false;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (callee.object.name !== "JSON") return false;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  return callee.property.name === "parse";
}

function isInsideEffectTryThunk(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | null | undefined = node.parent;
  while (current !== null && current !== undefined) {
    if (
      current.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      current.type === AST_NODE_TYPES.FunctionExpression
    ) {
      const parent = current.parent;
      if (
        parent !== null &&
        parent !== undefined &&
        parent.type === AST_NODE_TYPES.CallExpression
      ) {
        const callee = parent.callee;
        if (
          callee.type === AST_NODE_TYPES.MemberExpression &&
          !callee.computed &&
          callee.object.type === AST_NODE_TYPES.Identifier &&
          callee.object.name === "Effect" &&
          callee.property.type === AST_NODE_TYPES.Identifier &&
          (callee.property.name === "try" || callee.property.name === "tryPromise")
        ) {
          return true;
        }
      }
    }
    current = current.parent;
  }
  return false;
}

export default createRule({
  name: "parse-into-schema-requires-effect",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Schema.decode* applied to JSON.parse(...) without an Effect.try wrapper. JSON.parse can throw outside the Effect channel; wrap it so the SyntaxError joins the typed error union.",
    },
    messages: {
      parseNeedsEffectTry:
        "Schema.{{decoder}} fed JSON.parse(...) without Effect.try; JSON.parse's SyntaxError escapes the Effect channel. Wrap JSON.parse in Effect.try first.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const decoder = isSchemaDecodeCall(node);
        if (decoder === null) return;
        const parent = node.parent;
        if (parent === undefined) return;
        if (parent.type !== AST_NODE_TYPES.CallExpression) return;
        if (parent.callee !== node) return;
        const arg = parent.arguments[0];
        if (arg === undefined || arg.type === AST_NODE_TYPES.SpreadElement) return;
        if (!isJsonParseCall(arg)) return;
        if (isInsideEffectTryThunk(parent)) return;
        context.report({
          node: parent,
          messageId: "parseNeedsEffectTry",
          data: { decoder },
        });
      },
    };
  },
});
