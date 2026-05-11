import type { TSESTree } from "@typescript-eslint/utils";
import * as ts from "typescript";
import { createRule } from "../../utils/create-rule.js";
import { requireServices } from "../../utils/typed-linter/index.js";
import {
  resolveStringLiteralValue,
  getTagAccess,
} from "../../utils/ast-refinement/index.js";

const EQUALITY_OPERATORS = new Set(["==", "===", "!=", "!=="]);

const EFFECT_TAGGED_TYPE_PATTERN =
  /\b(?:Effect|Either|Option|Exit|Cause|Fiber|Stream|TaggedError|TaggedClass|TaggedEnum|ParseResult|Chunk\.NonEmpty|Equal\.Equal)\b/;

function resolveStringLiteral(node: TSESTree.Node | null): string | null {
  return resolveStringLiteralValue(node);
}

interface TagComparison {
  readonly tagAccess: TSESTree.Node;
  readonly receiver: TSESTree.Node;
  readonly comparedValue: TSESTree.Node;
}

function tagComparison(node: TSESTree.BinaryExpression): TagComparison | null {
  if (!EQUALITY_OPERATORS.has(node.operator)) return null;
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

function reportableTagComparison(node: TSESTree.BinaryExpression): TagComparison | null {
  const comparison = tagComparison(node);
  if (comparison === null) return null;
  if (resolveStringLiteral(comparison.comparedValue) === null) return null;
  return comparison;
}

function typeMentionsEffectTagged(type: ts.Type, checker: ts.TypeChecker): boolean {
  const typeString = checker.typeToString(type);
  if (EFFECT_TAGGED_TYPE_PATTERN.test(typeString)) return true;
  if (type.isUnion()) {
    return type.types.some((member) => typeMentionsEffectTagged(member, checker));
  }
  return false;
}

export default createRule({
  name: "tag-discriminant",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag manual `_tag` discriminant checks on Effect tagged unions. Use Effect.catchTag(...) / catchTags(...) for tagged errors and Match.tag(...) / Match.discriminator('_tag') for tagged unions.",
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
    if (maybeServices === null) return {};
    const services = maybeServices;
    const checker = services.program.getTypeChecker();

    function receiverIsEffectTagged(receiver: TSESTree.Node): boolean {
      const tsNode = services.esTreeNodeToTSNodeMap.get(receiver);
      if (!tsNode) return false;
      const type = checker.getTypeAtLocation(tsNode);
      return typeMentionsEffectTagged(type, checker);
    }

    function report(node: TSESTree.Node): void {
      context.report({ node, messageId: "tagDiscriminant" });
    }

    return {
      BinaryExpression(node) {
        const comparison = reportableTagComparison(node);
        if (comparison === null) return;
        if (!receiverIsEffectTagged(comparison.receiver)) return;
        report(node);
      },
      SwitchStatement(node) {
        const discriminant = getTagAccess(node.discriminant);
        if (discriminant === null) return;
        const hasStringCase = node.cases.some(
          (caseNode) => resolveStringLiteral(caseNode.test) !== null,
        );
        if (!hasStringCase) return;
        if (!receiverIsEffectTagged(discriminant.object)) return;
        report(node);
      },
    };
  },
});
