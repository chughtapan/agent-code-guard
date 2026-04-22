import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const EQUALITY_OPERATORS = new Set(["==", "===", "!=", "!=="]);
const EITHER_TAGS = new Set(["Left", "Right"]);
const EITHER_GUARDS = new Set(["isLeft", "isRight"]);

function isEitherTagLiteral(node: TSESTree.Node | null): boolean {
  return (
    node?.type === AST_NODE_TYPES.Literal &&
    typeof node.value === "string" &&
    EITHER_TAGS.has(node.value)
  );
}

function isTagAccess(node: TSESTree.Node): boolean {
  if (node.type === AST_NODE_TYPES.ChainExpression) {
    return isTagAccess(node.expression);
  }
  return (
    node.type === AST_NODE_TYPES.MemberExpression &&
    !node.computed &&
    node.property.type === AST_NODE_TYPES.Identifier &&
    node.property.name === "_tag"
  );
}

export default createRule({
  name: "either-discriminant",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag manual Either narrowing via `Either.isLeft` / `Either.isRight` or `_tag === \"Left\"`. Use `Either.match(...)` instead.",
    },
    messages: {
      eitherDiscriminant:
        "Manual Either discriminant — use Either.match(...) instead of isLeft/isRight or `_tag` checks.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function report(node: TSESTree.Node): void {
      context.report({ node, messageId: "eitherDiscriminant" });
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== AST_NODE_TYPES.MemberExpression || callee.computed) {
          return;
        }
        if (
          callee.object.type !== AST_NODE_TYPES.Identifier ||
          callee.object.name !== "Either"
        ) {
          return;
        }
        if (
          callee.property.type !== AST_NODE_TYPES.Identifier ||
          !EITHER_GUARDS.has(callee.property.name)
        ) {
          return;
        }
        report(node);
      },
      BinaryExpression(node) {
        if (!EQUALITY_OPERATORS.has(node.operator)) return;
        const leftIsTag = isTagAccess(node.left);
        const rightIsTag = isTagAccess(node.right);
        if (leftIsTag === rightIsTag) return;
        if (!isEitherTagLiteral(leftIsTag ? node.right : node.left)) return;
        report(node);
      },
      SwitchStatement(node) {
        if (!isTagAccess(node.discriminant)) return;
        if (!node.cases.some((caseNode) => isEitherTagLiteral(caseNode.test))) {
          return;
        }
        report(node);
      },
    };
  },
});
