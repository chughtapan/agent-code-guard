import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import {
  getParent,
  getStaticMemberPropertyName,
  getStaticStringKey,
  getStringLiteralValue,
  isNamedMemberCall,
} from "../utils/ast-refinement.js";

const ERROR_NAME_RE = /(Error|Failure|Failed|Exception)$/;

function looksErrorLike(name: string | null | undefined): boolean {
  return typeof name === "string" && ERROR_NAME_RE.test(name);
}

function classHasManualTagField(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): boolean {
  return node.body.body.some((member) => {
    if (member.type !== AST_NODE_TYPES.PropertyDefinition) return false;
    return getStaticStringKey(member.key, member.computed) === "_tag";
  });
}

function superClassLooksErrorLike(
  node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
): boolean {
  const superClass = node.superClass;
  if (!superClass) return false;
  if (superClass.type === AST_NODE_TYPES.Identifier) {
    return superClass.name === "Error" || looksErrorLike(superClass.name);
  }
  if (superClass.type === AST_NODE_TYPES.MemberExpression) {
    const name = getStaticMemberPropertyName(superClass);
    if (name === null) return false;
    return name === "Error" || looksErrorLike(name);
  }
  return false;
}

function typeElementIsTag(member: TSESTree.TypeElement): boolean {
  if (member.type !== AST_NODE_TYPES.TSPropertySignature) return false;
  return getStaticStringKey(member.key, member.computed) === "_tag";
}

function typeContainsManualTag(node: TSESTree.TypeNode): boolean {
  switch (node.type) {
    case AST_NODE_TYPES.TSTypeLiteral:
      return node.members.some(typeElementIsTag);
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType:
      return node.types.some(typeContainsManualTag);
    default:
      return false;
  }
}

function objectPropertyIsTag(member: TSESTree.Property): boolean {
  return getStaticStringKey(member.key, member.computed) === "_tag";
}

function objectHasManualTag(node: TSESTree.ObjectExpression): boolean {
  return node.properties.some(
    (member) =>
      member.type === AST_NODE_TYPES.Property && objectPropertyIsTag(member),
  );
}

function getObjectTagName(node: TSESTree.ObjectExpression): string | null {
  for (const member of node.properties) {
    if (member.type !== AST_NODE_TYPES.Property) continue;
    if (!objectPropertyIsTag(member)) continue;
    return getStringLiteralValue(member.value);
  }
  return null;
}

function newExpressionLooksErrorLike(node: TSESTree.NewExpression): boolean {
  const callee = node.callee;
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name === "Error" || looksErrorLike(callee.name);
  }
  if (callee.type === AST_NODE_TYPES.MemberExpression) {
    const name = getStaticMemberPropertyName(callee);
    return name === "Error" || looksErrorLike(name);
  }
  return false;
}

function isEffectFailCall(node: TSESTree.CallExpression): boolean {
  return isNamedMemberCall(node, "Effect", "fail");
}

function objectIsReturnedValue(node: TSESTree.ObjectExpression): boolean {
  let child: TSESTree.Node = node;
  let current = getParent(node);
  while (current !== null) {
    if (current.type === AST_NODE_TYPES.ReturnStatement) return true;
    if (
      current.type === AST_NODE_TYPES.ArrowFunctionExpression &&
      current.expression &&
      current.body === child
    ) {
      return true;
    }
    if (
      current.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      current.type === AST_NODE_TYPES.FunctionDeclaration ||
      current.type === AST_NODE_TYPES.FunctionExpression
    ) {
      return false;
    }
    child = current;
    current = getParent(current);
  }
  return false;
}

function objectIsErrorPayload(node: TSESTree.ObjectExpression): boolean {
  let current = getParent(node);
  while (current !== null) {
    if (current.type === AST_NODE_TYPES.NewExpression && newExpressionLooksErrorLike(current)) {
      return true;
    }
    if (current.type === AST_NODE_TYPES.CallExpression && isEffectFailCall(current)) {
      return true;
    }
    if (
      current.type === AST_NODE_TYPES.ArrowFunctionExpression ||
      current.type === AST_NODE_TYPES.FunctionDeclaration ||
      current.type === AST_NODE_TYPES.FunctionExpression
    ) {
      return false;
    }
    current = getParent(current);
  }
  return false;
}

export default createRule({
  name: "manual-tagged-error",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag hand-rolled tagged error classes and error unions that declare `_tag` manually. Use `Data.TaggedError(...)` instead.",
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

    function maybeReportClass(
      node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    ): void {
      if (!classHasManualTagField(node)) return;
      const className = node.id?.name ?? "(anonymous class)";
      if (!looksErrorLike(className) && !superClassLooksErrorLike(node)) return;
      report(node, className);
    }

    return {
      ClassDeclaration: maybeReportClass,
      ClassExpression: maybeReportClass,
      TSInterfaceDeclaration(node) {
        if (!looksErrorLike(node.id.name)) return;
        if (!node.body.body.some(typeElementIsTag)) return;
        report(node, node.id.name);
      },
      TSTypeAliasDeclaration(node) {
        if (!looksErrorLike(node.id.name)) return;
        if (!typeContainsManualTag(node.typeAnnotation)) return;
        report(node, node.id.name);
      },
      ObjectExpression(node) {
        if (!objectHasManualTag(node)) return;
        const tagName = getObjectTagName(node);
        if (objectIsErrorPayload(node)) {
          report(node, tagName ?? "tagged value");
          return;
        }
        if (!looksErrorLike(tagName)) return;
        if (!objectIsReturnedValue(node)) return;
        report(node, tagName ?? "tagged value");
      },
    };
  },
});
