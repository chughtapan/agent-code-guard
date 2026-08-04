/**
 * @file Google-style rules for numeric conversion, prototype mutation, and
 * descriptor-defined accessors.
 */

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import {
  getUnshadowedGlobalStaticCall,
  type GlobalStaticCallReference,
} from "../utils/global-namespace.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import { isUnshadowedGlobal } from "../utils/unshadowed-global.js";

const NUMBER_NAMESPACE: ReadonlySet<string> = new Set(["Number"]);

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
  const call = getUnshadowedGlobalStaticCall(
    sourceCode,
    node.callee,
    NUMBER_NAMESPACE,
  );
  return call?.method === name;
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
const PROTOTYPE_MUTATION_NAMESPACES: ReadonlySet<string> = new Set([
  "Object",
  "Reflect",
]);

function isSetPrototypeOf(call: GlobalStaticCallReference): boolean {
  if (call.method !== "setPrototypeOf") {
    return false;
  }
  return call.owner === "Object" || call.owner === "Reflect";
}

function firstArgumentTargetsPrototype(node: TSESTree.CallExpression): boolean {
  const target = node.arguments[0];
  return target?.type !== AST_NODE_TYPES.SpreadElement && targetsPrototype(target);
}

function supportsPrototypeTargetMutation(call: GlobalStaticCallReference): boolean {
  if (call.owner === "Object") {
    return OBJECT_PROTOTYPE_MUTATION_METHODS.has(call.method);
  }
  if (call.owner === "Reflect") {
    return REFLECT_PROTOTYPE_MUTATION_METHODS.has(call.method);
  }
  return false;
}

function isPrototypeTargetMutation(
  call: GlobalStaticCallReference,
  node: TSESTree.CallExpression,
): boolean {
  return supportsPrototypeTargetMutation(call) && firstArgumentTargetsPrototype(node);
}

function isPrototypeMutationCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
): boolean {
  const call = getUnshadowedGlobalStaticCall(
    sourceCode,
    node.callee,
    PROTOTYPE_MUTATION_NAMESPACES,
  );
  if (call === null) {
    return false;
  }
  return isSetPrototypeOf(call) || isPrototypeTargetMutation(call, node);
}

function isObjectLiteralDataProperty(node: TSESTree.Property): boolean {
  if (node.parent.type !== AST_NODE_TYPES.ObjectExpression) {
    return false;
  }
  if (node.computed || node.method || node.shorthand) {
    return false;
  }
  return node.kind === "init";
}

function isPrototypeSetterKey(node: TSESTree.Property["key"]): boolean {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name === "__proto__";
  }
  return node.type === AST_NODE_TYPES.Literal && node.value === "__proto__";
}

function isObjectLiteralPrototypeSetter(node: TSESTree.Property): boolean {
  return isObjectLiteralDataProperty(node) && isPrototypeSetterKey(node.key);
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
      Property(node) {
        if (isObjectLiteralPrototypeSetter(node)) {
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
