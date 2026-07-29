/**
 * @file Google-style class rules that require syntax-aware checks beyond the
 * maintained ESLint rule surface.
 */

import { type TSESLint, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

function isFunctionBoundary(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression
  );
}

function staticMemberValue(node: TSESTree.Node): boolean | null {
  if (
    node.type === AST_NODE_TYPES.MethodDefinition ||
    node.type === AST_NODE_TYPES.TSAbstractMethodDefinition
  ) {
    return node.static;
  }
  if (
    node.type === AST_NODE_TYPES.AccessorProperty ||
    node.type === AST_NODE_TYPES.PropertyDefinition ||
    node.type === AST_NODE_TYPES.TSAbstractAccessorProperty ||
    node.type === AST_NODE_TYPES.TSAbstractPropertyDefinition
  ) {
    return node.static;
  }
  if (node.type === AST_NODE_TYPES.StaticBlock) {
    return true;
  }
  return null;
}

function endsStaticThisLookup(node: TSESTree.Node): boolean {
  if (isFunctionBoundary(node)) {
    return node.parent?.type !== AST_NODE_TYPES.MethodDefinition;
  }
  return (
    node.type === AST_NODE_TYPES.ClassDeclaration || node.type === AST_NODE_TYPES.ClassExpression
  );
}

function belongsToStaticMember(node: TSESTree.ThisExpression): boolean {
  let current: TSESTree.Node | undefined = node.parent;
  while (current !== undefined) {
    const staticValue = staticMemberValue(current);
    if (staticValue !== null) {
      return staticValue;
    }
    if (endsStaticThisLookup(current)) {
      return false;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Rejects dynamic `this` access in static members.
 */
export const noStaticThis = createRule({
  name: "no-static-this",
  meta: {
    type: "problem",
    docs: {
      description:
        "Static this dispatch inherits and overrides state unexpectedly; reference the declaring class directly.",
      url: PRINCIPLE_URL.TYPES_BEAT_TESTS,
    },
    messages: {
      staticThis:
        "Do not use `this` in a static context; reference the class that declares the member.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      ThisExpression(node) {
        if (!belongsToStaticMember(node)) {
          return;
        }
        context.report({ node, messageId: "staticThis" });
      },
    };
  },
});

/**
 * Rejects JavaScript private identifiers in favor of TypeScript visibility.
 */
export const noPrivateIdentifiers = createRule({
  name: "no-private-identifiers",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "One project-wide visibility model is easier to audit than mixing TypeScript private with runtime private fields.",
      url: PRINCIPLE_URL.DISCIPLINE,
    },
    messages: {
      privateIdentifier: "Do not use `#private` identifiers; use TypeScript `private` visibility.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      PrivateIdentifier(node) {
        context.report({ node, messageId: "privateIdentifier" });
      },
    };
  },
});

function publicMemberNode(
  node:
    | TSESTree.AccessorProperty
    | TSESTree.MethodDefinition
    | TSESTree.PropertyDefinition
    | TSESTree.TSAbstractAccessorProperty
    | TSESTree.TSAbstractMethodDefinition
    | TSESTree.TSAbstractPropertyDefinition,
): TSESTree.Node | null {
  if (node.accessibility !== "public") {
    return null;
  }
  return node.key;
}

function reportRedundantPublic(
  context: Readonly<TSESLint.RuleContext<"redundantPublic", []>>,
  node:
    | TSESTree.AccessorProperty
    | TSESTree.MethodDefinition
    | TSESTree.PropertyDefinition
    | TSESTree.TSAbstractAccessorProperty
    | TSESTree.TSAbstractMethodDefinition
    | TSESTree.TSAbstractPropertyDefinition,
): void {
  const reportNode = publicMemberNode(node);
  if (reportNode === null) {
    return;
  }
  context.report({ node: reportNode, messageId: "redundantPublic" });
}

/**
 * Rejects redundant explicit public modifiers.
 */
export const noRedundantPublic = createRule({
  name: "no-redundant-public",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Public is TypeScript's class-member default; repeating it obscures the visibility modifiers that carry information.",
      url: PRINCIPLE_URL.DISCIPLINE,
    },
    messages: {
      redundantPublic: "Omit the redundant `public` modifier; public is the default visibility.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      AccessorProperty(node) {
        reportRedundantPublic(context, node);
      },
      MethodDefinition(node) {
        reportRedundantPublic(context, node);
      },
      PropertyDefinition(node) {
        reportRedundantPublic(context, node);
      },
      TSParameterProperty(node) {
        if (node.accessibility !== "public" || !node.readonly) {
          return;
        }
        context.report({ node, messageId: "redundantPublic" });
      },
      TSAbstractAccessorProperty(node) {
        reportRedundantPublic(context, node);
      },
      TSAbstractMethodDefinition(node) {
        reportRedundantPublic(context, node);
      },
      TSAbstractPropertyDefinition(node) {
        reportRedundantPublic(context, node);
      },
    };
  },
});
