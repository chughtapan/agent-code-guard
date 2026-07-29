/**
 * @file Requires a durable local rationale for TypeScript assertions that
 * suppress compiler evidence.
 */

import { type TSESLint, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

const RATIONALE_PATTERN =
  /\b(because|generated|guarantee[ds]?|invariant|known|reason|safe|validated)\b/i;

function isConstAssertion(node: TSESTree.TSAsExpression): boolean {
  const annotation = node.typeAnnotation;
  return (
    annotation.type === AST_NODE_TYPES.TSTypeReference &&
    annotation.typeName.type === AST_NODE_TYPES.Identifier &&
    annotation.typeName.name === "const"
  );
}

function hasRationale(sourceCode: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): boolean {
  const comments = sourceCode.getCommentsBefore(node);
  const comment = comments.at(-1);
  if (comment === undefined) {
    return false;
  }
  if (comment.loc.end.line + 1 < node.loc.start.line) {
    return false;
  }
  const explanation = comment.value.trim();
  return explanation.length >= 10 && RATIONALE_PATTERN.test(explanation);
}

/**
 * Requires a nearby explanation for type and non-null assertions.
 */
export const requireAssertionRationale = createRule({
  name: "require-assertion-rationale",
  meta: {
    type: "problem",
    docs: {
      description:
        "Assertions silence compiler evidence; a local rationale records the invariant that makes the escape hatch safe.",
      url: PRINCIPLE_URL.TYPES_BEAT_TESTS,
    },
    messages: {
      rationale:
        "Add an immediately preceding rationale explaining why this assertion is safe, or replace it with runtime validation.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;

    function maybeReport(node: TSESTree.Node): void {
      if (hasRationale(sourceCode, node)) {
        return;
      }
      context.report({ node, messageId: "rationale" });
    }

    return {
      TSAsExpression(node) {
        if (isConstAssertion(node)) {
          return;
        }
        maybeReport(node);
      },
      TSNonNullExpression: maybeReport,
      TSTypeAssertion: maybeReport,
    };
  },
});
