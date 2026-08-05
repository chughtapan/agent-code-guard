/**
 * @file Type-aware enforcement for Google Style's ban on treating enum
 * values as booleans.
 */

import {
  AST_NODE_TYPES,
  type ParserServicesWithTypeInformation,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";
import * as ts from "typescript";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import { requireServices } from "../utils/typed-linter/index.js";
import { isUnshadowedGlobal } from "../utils/unshadowed-global.js";

function containsEnum(type: ts.Type): boolean {
  if ((type.flags & (ts.TypeFlags.Enum | ts.TypeFlags.EnumLiteral)) !== 0) {
    return true;
  }
  if (!type.isUnionOrIntersection()) {
    return false;
  }
  return type.types.some(containsEnum);
}

type ReportIfEnum = (node: TSESTree.Expression) => void;

function reportBooleanCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  reportIfEnum: ReportIfEnum,
  node: TSESTree.CallExpression,
): void {
  if (
    node.callee.type !== AST_NODE_TYPES.Identifier ||
    node.callee.name !== "Boolean" ||
    !isUnshadowedGlobal(sourceCode, node.callee)
  ) {
    return;
  }
  const argument = node.arguments[0];
  if (argument === undefined || argument.type === AST_NODE_TYPES.SpreadElement) {
    return;
  }
  reportIfEnum(argument);
}

function enumBooleanListeners(
  context: TSESLint.RuleContext<"enumBoolean", []>,
  services: ParserServicesWithTypeInformation,
): TSESLint.RuleListener {
  const checker = services.program.getTypeChecker();

  function reportIfEnum(node: TSESTree.Expression): void {
    const tsNode = services.esTreeNodeToTSNodeMap.get(node);
    if (tsNode === undefined) {
      return;
    }
    if (!containsEnum(checker.getTypeAtLocation(tsNode))) {
      return;
    }
    context.report({ node, messageId: "enumBoolean" });
  }

  return enumBooleanVisitor(context.sourceCode, reportIfEnum);
}

function enumBooleanVisitor(
  sourceCode: Readonly<TSESLint.SourceCode>,
  reportIfEnum: ReportIfEnum,
): TSESLint.RuleListener {
  return {
    CallExpression(node) {
      reportBooleanCall(sourceCode, reportIfEnum, node);
    },
    ConditionalExpression(node) {
      reportIfEnum(node.test);
    },
    DoWhileStatement(node) {
      reportIfEnum(node.test);
    },
    ForStatement(node) {
      if (node.test !== null) {
        reportIfEnum(node.test);
      }
    },
    IfStatement(node) {
      reportIfEnum(node.test);
    },
    LogicalExpression(node) {
      if (node.operator !== "??") {
        reportIfEnum(node.left);
      }
    },
    UnaryExpression(node) {
      if (node.operator === "!") {
        reportIfEnum(node.argument);
      }
    },
    WhileStatement(node) {
      reportIfEnum(node.test);
    },
  };
}

/**
 * Rejects explicit and implicit boolean coercion of enum values.
 */
export const noEnumBooleanCoercion = createRule({
  name: "no-enum-boolean-coercion",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enum zero values are falsy; explicit comparisons keep every enum member semantically distinct.",
      url: PRINCIPLE_URL.EXHAUSTIVENESS,
    },
    messages: {
      enumBoolean:
        "Do not coerce an enum to boolean; compare it explicitly with the intended enum member.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const services = requireServices(context);
    if (services === null) {
      return {};
    }
    return enumBooleanListeners(context, services);
  },
});
