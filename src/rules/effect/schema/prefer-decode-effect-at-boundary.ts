import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../../utils/create-rule.js";

const SYNC_DECODE_METHODS = new Set([
  "decodeUnknownSync",
  "decodeSync",
  "decodeUnknownEither",
]);

const IO_LIKE_CALLS: ReadonlyArray<readonly [string | null, string]> = [
  [null, "JSON.parse"],
  ["fs", "readFileSync"],
  ["fs", "readFile"],
  ["fsSync", "readFileSync"],
  ["fs", "existsSync"],
  ["http", "get"],
  ["request", null],
];

function isSchemaSyncDecodeCall(node: TSESTree.CallExpression): string | null {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  const callee = node.callee;
  if (callee.computed) return null;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return null;
  if (callee.object.name !== "Schema") return null;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return null;
  if (!SYNC_DECODE_METHODS.has(callee.property.name)) return null;
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

function isFetchOrIoCall(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.AwaitExpression) return isFetchOrIoCall(node.argument);
  if (node.type !== AST_NODE_TYPES.CallExpression) return false;
  const callee = node.callee;
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name === "fetch";
  }
  if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
  if (callee.computed) return false;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  return IO_LIKE_CALLS.some(([objectName, methodName]) =>
    matchesIoCall(callee, objectName, methodName)
  );
}

function matchesIoCall(
  callee: TSESTree.MemberExpression,
  objectName: string | null,
  methodName: string,
): boolean {
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return false;
  if (callee.property.name !== methodName) return false;
  if (objectName === null) return true;
  return (
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === objectName
  );
}

function appliedArgumentIsIoLike(
  appliedCall: TSESTree.CallExpression,
): boolean {
  const arg = appliedCall.arguments[0];
  if (arg === undefined) return false;
  if (arg.type === AST_NODE_TYPES.SpreadElement) return false;
  if (isJsonParseCall(arg)) return true;
  if (isFetchOrIoCall(arg)) return true;
  return false;
}

export default createRule({
  name: "prefer-decode-effect-at-boundary",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Schema.decodeUnknownSync (and sibling sync decoders) applied to data that just came out of JSON.parse, fs.read*, or fetch. Use the Effect-returning decoder so failures stay typed.",
    },
    messages: {
      syncDecodeAtBoundary:
        "Schema.{{method}} on data from {{source}}; use Schema.decodeUnknown (Effect-returning) so the decode error joins the Effect's error channel instead of throwing at the boundary.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const method = isSchemaSyncDecodeCall(node);
        if (method === null) return;
        const parent = node.parent;
        if (parent === undefined) return;
        if (parent.type !== AST_NODE_TYPES.CallExpression) return;
        if (parent.callee !== node) return;
        if (!appliedArgumentIsIoLike(parent)) return;
        const source = describeIoSource(parent.arguments[0]);
        context.report({
          node: parent,
          messageId: "syncDecodeAtBoundary",
          data: { method, source },
        });
      },
    };
  },
});

function describeIoSource(node: TSESTree.CallExpressionArgument | undefined): string {
  if (node === undefined) return "I/O";
  if (isJsonParseCall(node)) return "JSON.parse";
  if (isFetchOrIoCall(node)) return "an I/O call (fs.read*, fetch, etc.)";
  return "I/O";
}
