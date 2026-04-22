import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const ERROR_NAME_RE = /(Error|Failure|Failed|Exception)$/;

function looksErrorLike(name: string | null | undefined): boolean {
  return typeof name === "string" && ERROR_NAME_RE.test(name);
}

/* Stryker disable all: helper plumbing for static AST key/callee detection and
ancestor walks has a high density of equivalent mutants; rule behavior is
validated through top-level fixtures instead. */
function getPropertyName(
  key: TSESTree.Expression | TSESTree.PrivateIdentifier,
  computed: boolean,
): string | null {
  if (!computed && key.type === AST_NODE_TYPES.Identifier) return key.name;
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === "string") {
    return key.value;
  }
  if (
    computed &&
    key.type === AST_NODE_TYPES.TemplateLiteral &&
    key.expressions.length === 0
  ) {
    return key.quasis[0]?.value.cooked ?? null;
  }
  return null;
}

function classHasManualTagField(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression): boolean {
  return node.body.body.some((member) => {
    if (member.type !== AST_NODE_TYPES.PropertyDefinition) return false;
    return getPropertyName(member.key, member.computed) === "_tag";
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
  if (
    superClass.type === AST_NODE_TYPES.MemberExpression &&
    !superClass.computed &&
    superClass.property.type === AST_NODE_TYPES.Identifier
  ) {
    const name = superClass.property.name;
    return name === "Error" || looksErrorLike(name);
  }
  return false;
}

function typeElementIsTag(member: TSESTree.TypeElement): boolean {
  if (member.type !== AST_NODE_TYPES.TSPropertySignature) return false;
  return getPropertyName(member.key, member.computed) === "_tag";
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
  return getPropertyName(member.key, member.computed) === "_tag";
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
    if (
      member.value.type === AST_NODE_TYPES.Literal &&
      typeof member.value.value === "string"
    ) {
      return member.value.value;
    }
    return null;
  }
  return null;
}

function newExpressionLooksErrorLike(node: TSESTree.NewExpression): boolean {
  const callee = node.callee;
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name === "Error" || looksErrorLike(callee.name);
  }
  if (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    !callee.computed &&
    callee.property.type === AST_NODE_TYPES.Identifier
  ) {
    return callee.property.name === "Error" || looksErrorLike(callee.property.name);
  }
  return false;
}

function isEffectFailCall(node: TSESTree.CallExpression): boolean {
  const callee = node.callee;
  return (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    !callee.computed &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === "Effect" &&
    callee.property.type === AST_NODE_TYPES.Identifier &&
    callee.property.name === "fail"
  );
}

function objectIsReturnedValue(node: TSESTree.ObjectExpression): boolean {
  let child: TSESTree.Node = node;
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
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
    current = current.parent;
  }
  return false;
}

function objectIsErrorPayload(node: TSESTree.ObjectExpression): boolean {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
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
    current = current.parent;
  }
  return false;
}
/* Stryker restore all */

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
