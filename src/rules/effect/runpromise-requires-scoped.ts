import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { requireServices } from "../../utils/parser-services.js";

const SCOPED_RUNNERS = new Set(["runPromise", "runPromiseExit", "runSync", "runSyncExit"]);

function effectRunnerCall(node: TSESTree.CallExpression): string | null {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  const callee = node.callee;
  if (callee.computed) return null;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return null;
  if (callee.object.name !== "Effect") return null;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return null;
  if (!SCOPED_RUNNERS.has(callee.property.name)) return null;
  return callee.property.name;
}

function typeStringMentionsScope(typeString: string): boolean {
  return /\bScope(\.Scope)?\b/.test(typeString);
}

export default createRule({
  name: "runpromise-requires-scoped",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Effect.runPromise / runSync where the input Effect requires a Scope but is not provided one.",
    },
    messages: {
      runRequiresScope:
        "Effect passed to Effect.{{runner}} requires a Scope in its requirements; wrap with Effect.scoped or provide a Layer.scoped before running.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const services = requireServices(context);
    if (services === null) return {};
    const checker = services.program.getTypeChecker();
    return {
      CallExpression(node) {
        const runner = effectRunnerCall(node);
        if (runner === null) return;
        const arg = node.arguments[0];
        if (arg === undefined || arg.type === AST_NODE_TYPES.SpreadElement) return;
        const tsNode = services.esTreeNodeToTSNodeMap.get(arg);
        const type = checker.getTypeAtLocation(tsNode);
        const typeString = checker.typeToString(type);
        if (!typeStringMentionsScope(typeString)) return;
        context.report({
          node,
          messageId: "runRequiresScope",
          data: { runner },
        });
      },
    };
  },
});
