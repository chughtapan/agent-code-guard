/**
 * @file Finds Error-like classes, tag-bearing types, and returned failure
 * payloads that hand-roll variants while leaving ordinary tagged data alone.
 */

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import {
  getParent,
  getStaticMemberPropertyName,
  getStaticStringKey,
  isNamedMemberCall,
  resolveStringLiteralValue,
} from "../utils/ast-refinement/index.js";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

const ERROR_NAME_RE = /(Error|Failure|Failed|Exception)$/;

function resolveErrorLikeName(name?: string | null): boolean {
  return typeof name === "string" && ERROR_NAME_RE.test(name);
}

function resolveIdentifierOrMemberName(node: TSESTree.Expression | null): string | null {
  if (node?.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  return node?.type === AST_NODE_TYPES.MemberExpression ? getStaticMemberPropertyName(node) : null;
}

function isManualTagKey(
  key: TSESTree.Expression | TSESTree.PrivateIdentifier,
  computed: boolean,
): boolean {
  return getStaticStringKey(key, computed) === "_tag";
}

function classHasManualTagField(
  node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
): boolean {
  return node.body.body.some(
    (member) =>
      member.type === AST_NODE_TYPES.PropertyDefinition &&
      isManualTagKey(member.key, member.computed),
  );
}

function superClassLooksErrorLike(
  node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
): boolean {
  return resolveErrorLikeName(resolveIdentifierOrMemberName(node.superClass));
}

function typeElementIsTag(member: TSESTree.TypeElement): boolean {
  return (
    member.type === AST_NODE_TYPES.TSPropertySignature &&
    isManualTagKey(member.key, member.computed)
  );
}

function typeContainsManualTag(node: TSESTree.TypeNode): boolean {
  if (node.type === AST_NODE_TYPES.TSTypeLiteral) {
    return node.members.some(typeElementIsTag);
  }
  if (node.type === AST_NODE_TYPES.TSUnionType || node.type === AST_NODE_TYPES.TSIntersectionType) {
    return node.types.some(typeContainsManualTag);
  }
  return false;
}

function objectPropertyIsTag(member: TSESTree.Property): boolean {
  return isManualTagKey(member.key, member.computed);
}

function objectHasManualTag(node: TSESTree.ObjectExpression): boolean {
  return node.properties.some(
    (member) => member.type === AST_NODE_TYPES.Property && objectPropertyIsTag(member),
  );
}

function getObjectTagName(node: TSESTree.ObjectExpression): string | null {
  for (const member of node.properties) {
    const tagName = objectPropertyTagName(member);
    if (tagName !== null) {
      return tagName;
    }
  }
  return null;
}

function objectPropertyTagName(member: TSESTree.ObjectLiteralElement): string | null {
  if (member.type !== AST_NODE_TYPES.Property) {
    return null;
  }
  return objectPropertyIsTag(member) ? resolveStringLiteralValue(member.value) : null;
}

function newExpressionLooksErrorLike(node: TSESTree.NewExpression): boolean {
  return resolveErrorLikeName(resolveIdentifierOrMemberName(node.callee));
}

function isEffectFailCall(node: TSESTree.CallExpression): boolean {
  return isNamedMemberCall(node, "Effect", "fail");
}

const TRANSPARENT_RETURN_WRAPPERS: ReadonlySet<string> = new Set([
  AST_NODE_TYPES.ChainExpression,
  AST_NODE_TYPES.TSAsExpression,
  AST_NODE_TYPES.TSNonNullExpression,
  AST_NODE_TYPES.TSSatisfiesExpression,
  AST_NODE_TYPES.TSTypeAssertion,
]);

function isTransparentReturnWrapper(node: TSESTree.Node): boolean {
  return TRANSPARENT_RETURN_WRAPPERS.has(node.type);
}

function objectIsReturnedValue(node: TSESTree.ObjectExpression): boolean {
  let child: TSESTree.Node = node;
  let current = getParent(node);
  while (current !== null) {
    const status = returnedValueStatus(current, child);
    if (status !== "wrapped") {
      return status === "returned";
    }
    child = current;
    current = getParent(current);
  }
  return false;
}

type ReturnedValueStatus = "returned" | "not-returned" | "wrapped";

function returnedValueStatus(current: TSESTree.Node, child: TSESTree.Node): ReturnedValueStatus {
  if (current.type === AST_NODE_TYPES.ReturnStatement) {
    return current.argument === child ? "returned" : "not-returned";
  }
  if (implicitArrowReturnsChild(current, child)) {
    return "returned";
  }
  if (isFunctionBoundary(current)) {
    return "not-returned";
  }
  return isTransparentReturnWrapper(current) ? "wrapped" : "not-returned";
}

function implicitArrowReturnsChild(current: TSESTree.Node, child: TSESTree.Node): boolean {
  return (
    current.type === AST_NODE_TYPES.ArrowFunctionExpression &&
    current.expression &&
    current.body === child
  );
}

function isFunctionBoundary(current: TSESTree.Node): boolean {
  return (
    current.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    current.type === AST_NODE_TYPES.FunctionDeclaration ||
    current.type === AST_NODE_TYPES.FunctionExpression
  );
}

function objectIsErrorPayload(node: TSESTree.ObjectExpression): boolean {
  let current = getParent(node);
  while (current !== null) {
    const status = errorPayloadStatus(current);
    if (status !== "continue") {
      return status === "payload";
    }
    current = getParent(current);
  }
  return false;
}

type ErrorPayloadStatus = "payload" | "not-payload" | "continue";

function errorPayloadStatus(current: TSESTree.Node): ErrorPayloadStatus {
  if (current.type === AST_NODE_TYPES.NewExpression) {
    return newExpressionLooksErrorLike(current) ? "payload" : "continue";
  }
  if (current.type === AST_NODE_TYPES.CallExpression) {
    return isEffectFailCall(current) ? "payload" : "continue";
  }
  return isFunctionBoundary(current) ? "not-payload" : "continue";
}

type ReportManualTaggedError = (node: TSESTree.Node, name: string) => void;

function maybeReportClass(
  report: ReportManualTaggedError,
  node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
): void {
  if (!classHasManualTagField(node)) {
    return;
  }
  const className = node.id?.name ?? "(anonymous class)";
  if (!resolveErrorLikeName(className) && !superClassLooksErrorLike(node)) {
    return;
  }
  report(node, className);
}

function maybeReportInterface(
  report: ReportManualTaggedError,
  node: TSESTree.TSInterfaceDeclaration,
): void {
  if (resolveErrorLikeName(node.id.name) && node.body.body.some(typeElementIsTag)) {
    report(node, node.id.name);
  }
}

function maybeReportAlias(
  report: ReportManualTaggedError,
  node: TSESTree.TSTypeAliasDeclaration,
): void {
  if (resolveErrorLikeName(node.id.name) && typeContainsManualTag(node.typeAnnotation)) {
    report(node, node.id.name);
  }
}

function maybeReportObject(report: ReportManualTaggedError, node: TSESTree.ObjectExpression): void {
  if (!objectHasManualTag(node)) {
    return;
  }
  const tagName = getObjectTagName(node);
  if (objectIsErrorPayload(node)) {
    report(node, tagName ?? "tagged value");
    return;
  }
  if (resolveErrorLikeName(tagName) && objectIsReturnedValue(node)) {
    report(node, tagName ?? "tagged value");
  }
}

function manualTaggedErrorListeners(report: ReportManualTaggedError): TSESLint.RuleListener {
  return {
    ClassDeclaration(node) {
      maybeReportClass(report, node);
    },
    ClassExpression(node) {
      maybeReportClass(report, node);
    },
    TSInterfaceDeclaration(node) {
      maybeReportInterface(report, node);
    },
    TSTypeAliasDeclaration(node) {
      maybeReportAlias(report, node);
    },
    ObjectExpression(node) {
      maybeReportObject(report, node);
    },
  };
}

/**
 * Enforces the `manual-tagged-error` Agent Code Guard rule.
 */
export const manualTaggedError = createRule({
  name: "manual-tagged-error",
  meta: {
    type: "problem",
    docs: {
      description:
        "Hand-rolled tagged errors miss the constructor pattern that makes the tag set extensible; use the project's helper.",
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
    },
    messages: {
      manualTaggedError:
        "Manual tagged error surface {{name}} — use Data.TaggedError(...) or a tagged constructor instead of hand-rolling `_tag`.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    function report(node: TSESTree.Node, name: string): void {
      context.report({
        node,
        messageId: "manualTaggedError",
        data: { name },
      });
    }

    return manualTaggedErrorListeners(report);
  },
});
