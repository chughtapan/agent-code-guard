/**
 * @file Google-style rules for numeric conversion, prototype mutation, and
 * descriptor-defined accessors.
 */

import { type TSESLint, type TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import { isUnshadowedGlobal } from "../utils/unshadowed-global.js";

function isGlobalCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
  name: string,
): boolean {
  return (
    node.callee.type === AST_NODE_TYPES.Identifier &&
    node.callee.name === name &&
    isUnshadowedGlobal(sourceCode, node.callee)
  );
}

function isNumberNamespaceCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
  name: string,
): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }
  return (
    node.callee.object.type === AST_NODE_TYPES.Identifier &&
    node.callee.object.name === "Number" &&
    isUnshadowedGlobal(sourceCode, node.callee.object) &&
    staticMemberName(node.callee) === name
  );
}

function isGlobalThisCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
  name: string,
): boolean {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }
  return (
    node.callee.object.type === AST_NODE_TYPES.Identifier &&
    node.callee.object.name === "globalThis" &&
    isUnshadowedGlobal(sourceCode, node.callee.object) &&
    staticMemberName(node.callee) === name
  );
}

function isNumericParserCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
  name: string,
): boolean {
  return (
    isGlobalCall(sourceCode, node, name) ||
    isNumberNamespaceCall(sourceCode, node, name) ||
    isGlobalThisCall(sourceCode, node, name)
  );
}

function isValidNonDecimalRadix(node?: TSESTree.Expression): boolean {
  if (node?.type !== AST_NODE_TYPES.Literal || typeof node.value !== "number") {
    return false;
  }
  return Number.isInteger(node.value) && node.value >= 2 && node.value <= 36 && node.value !== 10;
}

/**
 * Rejects implicit or ambiguous string-to-number conversion.
 */
export const noUnsafeNumericCoercion = createRule({
  name: "no-unsafe-numeric-coercion",
  meta: {
    type: "problem",
    docs: {
      description:
        "Explicit Number conversion plus NaN validation avoids partial parsing and unary-plus coercion surprises.",
      url: PRINCIPLE_URL.VALIDATE_AT_BOUNDARY,
    },
    messages: {
      parseFloat: "Do not use parseFloat; use Number(value) and explicitly validate NaN.",
      parseInt:
        "Use parseInt only for a validated non-base-10 conversion with an explicit literal radix.",
      unaryPlus: "Do not coerce with unary `+`; use Number(value) and explicitly validate NaN.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      CallExpression(node) {
        if (isNumericParserCall(sourceCode, node, "parseFloat")) {
          context.report({ node, messageId: "parseFloat" });
          return;
        }
        if (!isNumericParserCall(sourceCode, node, "parseInt")) {
          return;
        }
        const radix = node.arguments[1];
        if (radix?.type !== AST_NODE_TYPES.SpreadElement && isValidNonDecimalRadix(radix)) {
          return;
        }
        context.report({ node, messageId: "parseInt" });
      },
      UnaryExpression(node) {
        if (node.operator === "+") {
          context.report({ node, messageId: "unaryPlus" });
        }
      },
    };
  },
});

function staticMemberName(node: TSESTree.Expression): string | null {
  if (node.type !== AST_NODE_TYPES.MemberExpression) {
    return null;
  }
  if (node.property.type === AST_NODE_TYPES.Identifier && !node.computed) {
    return node.property.name;
  }
  if (node.property.type !== AST_NODE_TYPES.Literal) {
    return null;
  }
  return typeof node.property.value === "string" ? node.property.value : null;
}

function targetsPrototype(node: TSESTree.Expression): boolean {
  if (node.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }
  const name = staticMemberName(node);
  if (name === "prototype" || name === "__proto__") {
    return true;
  }
  return targetsPrototype(node.object);
}

interface StaticCall {
  readonly method: string;
  readonly owner: TSESTree.Identifier;
}

const OBJECT_PROTOTYPE_MUTATION_METHODS: ReadonlySet<string> = new Set([
  "assign",
  "defineProperties",
  "defineProperty",
]);
const REFLECT_PROTOTYPE_MUTATION_METHODS: ReadonlySet<string> = new Set([
  "defineProperty",
  "deleteProperty",
  "set",
]);

function staticCall(node: TSESTree.CallExpression): StaticCall | null {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    return null;
  }
  if (node.callee.object.type !== AST_NODE_TYPES.Identifier) {
    return null;
  }
  const method = staticMemberName(node.callee);
  if (method === null) {
    return null;
  }
  return {
    method,
    owner: node.callee.object,
  };
}

function isSetPrototypeOf(sourceCode: Readonly<TSESLint.SourceCode>, call: StaticCall): boolean {
  if (call.method !== "setPrototypeOf") {
    return false;
  }
  return (
    (call.owner.name === "Object" || call.owner.name === "Reflect") &&
    isUnshadowedGlobal(sourceCode, call.owner)
  );
}

function firstArgumentTargetsPrototype(node: TSESTree.CallExpression): boolean {
  const target = node.arguments[0];
  return target?.type !== AST_NODE_TYPES.SpreadElement && targetsPrototype(target);
}

function supportsPrototypeTargetMutation(call: StaticCall): boolean {
  if (call.owner.name === "Object") {
    return OBJECT_PROTOTYPE_MUTATION_METHODS.has(call.method);
  }
  if (call.owner.name === "Reflect") {
    return REFLECT_PROTOTYPE_MUTATION_METHODS.has(call.method);
  }
  return false;
}

function isPrototypeTargetMutation(
  sourceCode: Readonly<TSESLint.SourceCode>,
  call: StaticCall,
  node: TSESTree.CallExpression,
): boolean {
  if (!isUnshadowedGlobal(sourceCode, call.owner)) {
    return false;
  }
  return supportsPrototypeTargetMutation(call) && firstArgumentTargetsPrototype(node);
}

function isPrototypeMutationCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
): boolean {
  const call = staticCall(node);
  if (call === null) {
    return false;
  }
  return isSetPrototypeOf(sourceCode, call) || isPrototypeTargetMutation(sourceCode, call, node);
}

/**
 * Rejects prototype mutation and prototype-targeted property definition.
 */
export const noPrototypeManipulation = createRule({
  name: "no-prototype-manipulation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Prototype mutation changes behavior outside the local type contract and can modify builtins globally.",
      url: PRINCIPLE_URL.TYPES_BEAT_TESTS,
    },
    messages: {
      prototype:
        "Do not assign to or mutate prototypes; declare behavior in classes or plain objects.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      AssignmentExpression(node) {
        if (node.left.type === AST_NODE_TYPES.MemberExpression && targetsPrototype(node.left)) {
          context.report({ node, messageId: "prototype" });
        }
      },
      CallExpression(node) {
        if (isPrototypeMutationCall(sourceCode, node)) {
          context.report({ node, messageId: "prototype" });
        }
      },
      UnaryExpression(node) {
        if (
          node.operator === "delete" &&
          node.argument.type === AST_NODE_TYPES.MemberExpression &&
          targetsPrototype(node.argument)
        ) {
          context.report({ node, messageId: "prototype" });
        }
      },
      UpdateExpression(node) {
        if (
          node.argument.type === AST_NODE_TYPES.MemberExpression &&
          targetsPrototype(node.argument)
        ) {
          context.report({ node, messageId: "prototype" });
        }
      },
    };
  },
});
