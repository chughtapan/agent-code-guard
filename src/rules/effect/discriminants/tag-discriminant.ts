/**
 * @file Validates tagged Effect values are narrowed with supported discriminant comparisons.
 */

import type { TSESTree } from "@typescript-eslint/utils";
import type * as ts from "typescript";
import { getTagAccess, resolveStringLiteralValue } from "../../utils/ast-refinement/index.js";
import { createRule } from "../../utils/create-rule.js";
import { PRINCIPLE_URL } from "../../utils/principles.js";
import { requireServices } from "../../utils/typed-linter/index.js";
import { EFFECT_TAGGED_TYPE_PATTERN } from "../effect-namespaces.js";

const EQUALITY_OPERATORS = new Set(["==", "===", "!=", "!=="]);

interface TagComparison {
  readonly tagAccess: TSESTree.Node;
  readonly receiver: TSESTree.Node;
  readonly comparedValue: TSESTree.Node;
}

function reportableTagComparison(node: TSESTree.BinaryExpression): TagComparison | null {
  const comparison = tagComparison(node);
  if (comparison === null) {
    return null;
  }
  if (resolveStringLiteral(comparison.comparedValue) === null) {
    return null;
  }
  return comparison;
}

function tagComparison(node: TSESTree.BinaryExpression): TagComparison | null {
  if (!EQUALITY_OPERATORS.has(node.operator)) {
    return null;
  }
  const leftTag = getTagAccess(node.left);
  const rightTag = getTagAccess(node.right);
  if (leftTag !== null && rightTag === null) {
    return { tagAccess: leftTag, receiver: leftTag.object, comparedValue: node.right };
  }
  if (rightTag !== null && leftTag === null) {
    return { tagAccess: rightTag, receiver: rightTag.object, comparedValue: node.left };
  }
  return null;
}

function resolveStringLiteral(node: TSESTree.Node | null): string | null {
  return resolveStringLiteralValue(node);
}

function typeMentionsEffectTagged(type: ts.Type, checker: ts.TypeChecker): boolean {
  const typeString = checker.typeToString(type);
  if (EFFECT_TAGGED_TYPE_PATTERN.test(typeString)) {
    return true;
  }
  if (type.isUnion()) {
    return type.types.some((member) => typeMentionsEffectTagged(member, checker));
  }
  return false;
}

/**
 * Enforces the `tag-discriminant` Agent Code Guard rule.
 */
export const tagDiscriminant = createRule({
  name: "tag-discriminant",
  meta: {
    type: "problem",
    docs: {
      description:
        "Discriminated unions match on the named tag, not on shape; shape-matching breaks when tags overlap.",
      url: PRINCIPLE_URL.EXHAUSTIVENESS,
    },
    messages: {
      tagDiscriminant:
        "Manual `_tag` discriminant on an Effect tagged union — use Effect.catchTag(...) / catchTags(...) for errors, or Match.tag(...) / Match.discriminator('_tag') for tagged unions.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const maybeServices = requireServices(context);
    if (maybeServices === null) {
      return {};
    }
    const services = maybeServices;
    const checker = services.program.getTypeChecker();

    function receiverIsEffectTagged(receiver: TSESTree.Node): boolean {
      const tsNode = services.esTreeNodeToTSNodeMap.get(receiver);
      if (!tsNode) {
        return false;
      }
      const type = checker.getTypeAtLocation(tsNode);
      return typeMentionsEffectTagged(type, checker);
    }

    function report(node: TSESTree.Node): void {
      context.report({ node, messageId: "tagDiscriminant" });
    }

    return {
      BinaryExpression(node) {
        const comparison = reportableTagComparison(node);
        if (comparison === null) {
          return;
        }
        if (!receiverIsEffectTagged(comparison.receiver)) {
          return;
        }
        report(node);
      },
      SwitchStatement(node) {
        const discriminant = getTagAccess(node.discriminant);
        if (discriminant === null) {
          return;
        }
        const hasStringCase = node.cases.some(
          (caseNode) => resolveStringLiteral(caseNode.test) !== null,
        );
        if (!hasStringCase) {
          return;
        }
        if (!receiverIsEffectTagged(discriminant.object)) {
          return;
        }
        report(node);
      },
    };
  },
});
