import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import {
  resolveStringLiteralValue,
  getTagAccess,
} from "../../utils/ast-refinement/index.js";

const EQUALITY_OPERATORS = new Set(["==", "===", "!=", "!=="]);

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
  return resolveStringLiteral(comparison.comparedValue) !== null;
}

export default createRule({
  name: "tag-discriminant",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag any manual `_tag` discriminant check. Use Effect.catchTag(...) / catchTags(...) for tagged errors and Match.tag(...) / Match.discriminator('_tag') for tagged unions.",
    },
    messages: {
      tagDiscriminant:
        "Manual `_tag` discriminant — use Effect.catchTag(...) / catchTags(...) for errors, or Match.tag(...) / Match.discriminator('_tag') for tagged unions.",
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
        const hasStringCase = node.cases.some(
          (caseNode) => resolveStringLiteral(caseNode.test) !== null,
        );
        if (!hasStringCase) return;
        report(node);
      },
    };
  },
});
