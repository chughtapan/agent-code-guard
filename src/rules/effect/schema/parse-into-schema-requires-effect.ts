import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { PRINCIPLE_URL } from "../../utils/principles.js";

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

const EFFECT_TRY_METHODS = new Set(["try", "tryPromise"]);

function isEffectTryCall(call: TSESTree.CallExpression): boolean {
  const callee = call.callee;
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  if (callee.computed) return false;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (callee.object.name !== "Effect") return false;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  return EFFECT_TRY_METHODS.has(callee.property.name);
}

function isFunctionLike(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionExpression
  );
}

function isThunkOfEffectTry(fn: TSESTree.Node): boolean {
  if (!isFunctionLike(fn)) return false;
  const parent = fn.parent;
  if (parent === null || parent === undefined) return false;
  if (parent.type !== AST_NODE_TYPES.CallExpression) return false;
  return isEffectTryCall(parent);
}

function isInsideEffectTryThunk(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | null | undefined = node.parent;
  while (current !== null && current !== undefined) {
    if (isThunkOfEffectTry(current)) return true;
    current = current.parent;
  }
  return false;
}

export default createRule({
  name: "parse-into-schema-requires-effect",
  meta: {
    type: "problem",
    docs: {
      description: "`Schema.decodeUnknownSync` throws on failure; effectful boundaries must use the Effect-returning decoder so failure stays in the typed channel.",
      url: PRINCIPLE_URL.VALIDATE_AT_BOUNDARY,
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
        const apply = applyCallOnJsonParse(node);
        if (apply === null) return;
        if (isInsideEffectTryThunk(apply)) return;
        context.report({
          node: apply,
          messageId: "parseNeedsEffectTry",
          data: { decoder },
        });
      },
    };
  },
});

function applyCallOnJsonParse(
  decodeCall: TSESTree.CallExpression,
): TSESTree.CallExpression | null {
  const parent = decodeCall.parent;
  if (parent === null || parent === undefined) return null;
  if (parent.type !== AST_NODE_TYPES.CallExpression) return null;
  if (parent.callee !== decodeCall) return null;
  const arg = parent.arguments[0];
  if (arg === undefined) return null;
  if (arg.type === AST_NODE_TYPES.SpreadElement) return null;
  if (!isJsonParseCall(arg)) return null;
  return parent;
}
