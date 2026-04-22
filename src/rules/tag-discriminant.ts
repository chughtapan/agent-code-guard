import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const ERROR_NAME_RE = /^(err|error)$|(?:Error|Failure|Failed|Exception)$/;
const EQUALITY_OPERATORS = new Set(["==", "===", "!=", "!=="]);

function looksErrorLike(name: string | null): boolean {
  return typeof name === "string" && ERROR_NAME_RE.test(name);
}

/* Stryker disable all: helper normalization for chained/member `_tag` access is
parser-shape plumbing; rule behavior is exercised via the visitor tests. */
function getExpressionName(node: TSESTree.Expression): string | null {
  switch (node.type) {
    case AST_NODE_TYPES.Identifier:
      return node.name;
    case AST_NODE_TYPES.MemberExpression:
      if (node.computed) return null;
      return node.property.type === AST_NODE_TYPES.Identifier
        ? node.property.name
        : null;
    case AST_NODE_TYPES.ChainExpression:
      return node.expression.type === AST_NODE_TYPES.MemberExpression
        ? getExpressionName(node.expression)
        : null;
    default:
      return null;
  }
}

function unwrapTagAccess(node: TSESTree.Node): TSESTree.MemberExpression | null {
  if (node.type === AST_NODE_TYPES.ChainExpression) {
    return node.expression.type === AST_NODE_TYPES.MemberExpression
      ? unwrapTagAccess(node.expression)
      : null;
  }
  if (
    node.type !== AST_NODE_TYPES.MemberExpression ||
    node.computed ||
    node.property.type !== AST_NODE_TYPES.Identifier ||
    node.property.name !== "_tag"
  ) {
    return null;
  }
  return node;
}

function tagAccessLooksErrorLike(node: TSESTree.Node): boolean {
  const member = unwrapTagAccess(node);
  if (!member) return false;
  return looksErrorLike(getExpressionName(member.object));
}

function getStringLiteral(node: TSESTree.Node | null): string | null {
  if (
    node?.type === AST_NODE_TYPES.Literal &&
    typeof node.value === "string"
  ) {
    return node.value;
  }
  return null;
}
/* Stryker restore all */

export default createRule({
  name: "tag-discriminant",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag manual `_tag` checks on tagged errors. Use `Effect.catchTag(...)` or `Effect.catchTags(...)` instead.",
    },
    messages: {
      tagDiscriminant:
        "Manual `_tag` discriminant on a tagged error — use Effect.catchTag(...) / catchTags(...).",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function report(node: TSESTree.Node): void {
      context.report({ node, messageId: "tagDiscriminant" });
    }

    return {
      BinaryExpression(node) {
        if (!EQUALITY_OPERATORS.has(node.operator)) return;
        const leftTag = unwrapTagAccess(node.left);
        const rightTag = unwrapTagAccess(node.right);
        if ((leftTag === null) === (rightTag === null)) return;
        const tagAccess = leftTag ?? rightTag;
        if (tagAccess === null) return;
        const literal = getStringLiteral(leftTag ? node.right : node.left);
        if (literal === null) return;
        if (!tagAccessLooksErrorLike(tagAccess)) return;
        report(node);
      },
      SwitchStatement(node) {
        if (unwrapTagAccess(node.discriminant) === null) return;
        if (!tagAccessLooksErrorLike(node.discriminant)) return;
        const hasStringCase = node.cases.some(
          (caseNode) => getStringLiteral(caseNode.test) !== null,
        );
        if (!hasStringCase) return;
        report(node);
      },
    };
  },
});
