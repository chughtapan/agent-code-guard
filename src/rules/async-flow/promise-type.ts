import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { isFunctionReturnTypeReference } from "../utils/ast-refinement/index.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

function isPromiseTypeReference(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.TSTypeReference &&
    node.typeName.type === AST_NODE_TYPES.Identifier &&
    node.typeName.name === "Promise"
  );
}

export default createRule({
  name: "promise-type",
  meta: {
    type: "problem",
    docs: {
      description: "`Promise<T>` erases the error channel; tagged-error or `Effect<T, E, R>` keep it visible.",
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
    },
    messages: {
      promiseReturn: "Promise<> return type — prefer Effect",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      TSTypeReference(node) {
        if (!isPromiseTypeReference(node)) return;
        if (!isFunctionReturnTypeReference(node)) return;
        context.report({ node, messageId: "promiseReturn" });
      },
    };
  },
});
