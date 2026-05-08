import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../../utils/create-rule.js";
import {
  getStaticMemberPropertyName,
  resolveStringLiteralValue,
  getTagAccess,
} from "../../../utils/ast-refinement/index.js";

const ERROR_NAME_RE = /^(err|error)$|(?:Error|Failure|Failed|Exception)$/;
const EQUALITY_OPERATORS = new Set(["==", "===", "!=", "!=="]);

function resolveErrorLikeName(name: string | null): boolean {
  return typeof name === "string" && ERROR_NAME_RE.test(name);
}

function getExpressionName(node: TSESTree.Expression): string | null {
  switch (node.type) {
    case AST_NODE_TYPES.Identifier:
      return node.name;
    case AST_NODE_TYPES.MemberExpression:
      return getStaticMemberPropertyName(node);
    case AST_NODE_TYPES.ChainExpression:
      return node.expression.type === AST_NODE_TYPES.MemberExpression
        ? getExpressionName(node.expression)
        : null;
    default:
      return null;
  }
}

function tagAccessLooksErrorLike(node: TSESTree.Node): boolean {
  const member = getTagAccess(node);
  if (!member) return false;
  return resolveErrorLikeName(getExpressionName(member.object));
}

function resolveStringLiteral(node: TSESTree.Node | null): string | null {
  return resolveStringLiteralValue(node);
}

interface TagComparison {
  readonly tagAccess: TSESTree.Node;
  readonly comparedValue: TSESTree.Node;
}

function tagComparison(node: TSESTree.BinaryExpression): TagComparison | null {
  if (!EQUALITY_OPERATORS.has(node.operator)) return null;
  const leftTag = getTagAccess(node.left);
  const rightTag = getTagAccess(node.right);
  if (leftTag !== null && rightTag === null) {
    return { tagAccess: leftTag, comparedValue: node.right };
  }
  if (rightTag !== null && leftTag === null) {
    return { tagAccess: rightTag, comparedValue: node.left };
  }
  return null;
}

function isReportableTagComparison(node: TSESTree.BinaryExpression): boolean {
  const comparison = tagComparison(node);
  if (comparison === null) return false;
  if (resolveStringLiteral(comparison.comparedValue) === null) return false;
  return tagAccessLooksErrorLike(comparison.tagAccess);
}

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
        if (!isReportableTagComparison(node)) return;
        report(node);
      },
      SwitchStatement(node) {
        const discriminant = getTagAccess(node.discriminant);
        if (discriminant === null) return;
        if (!tagAccessLooksErrorLike(discriminant)) return;
        const hasStringCase = node.cases.some(
          (caseNode) => resolveStringLiteral(caseNode.test) !== null,
        );
        if (!hasStringCase) return;
        report(node);
      },
    };
  },
});
