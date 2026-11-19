/**
 * @file Rejects try/finally cleanup inside generators that Effect drives.
 */

import { AST_NODE_TYPES, type TSESTree } from "@typescript-eslint/utils";
import { getStaticMemberExpression } from "../../utils/ast-refinement/index.js";
import { createRule } from "../../utils/create-rule.js";
import { PRINCIPLE_URL } from "../../utils/principles.js";

type FunctionNode =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

/**
 * Enforces the `gen-finally` Agent Code Guard rule.
 */
export const genFinally = createRule({
  name: "gen-finally",
  meta: {
    type: "problem",
    docs: {
      description:
        "Effect abandons a generator when a yielded effect fails, so a `finally` block inside an Effect-driven generator does not run on that path.",
      url: PRINCIPLE_URL.ERRORS_ARE_TYPED,
    },
    messages: {
      genFinally:
        "try/finally inside an Effect-driven generator; the finally block does not run when a yielded effect fails. Use Effect.ensuring (or Effect.acquireRelease).",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      TryStatement(node) {
        if (node.finalizer === null) {
          return;
        }
        const enclosing = nearestFunction(node);
        if (enclosing !== null && isEffectDrivenGenerator(enclosing)) {
          context.report({ node, messageId: "genFinally" });
        }
      },
    };
  },
});

function nearestFunction(node: TSESTree.Node): FunctionNode | null {
  let current = node.parent;
  while (current !== undefined) {
    if (isFunctionNode(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function isFunctionNode(node: TSESTree.Node): node is FunctionNode {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression
  );
}

function isEffectDrivenGenerator(fn: FunctionNode): boolean {
  const call = fn.parent;
  if (!fn.generator || call.type !== AST_NODE_TYPES.CallExpression) {
    return false;
  }
  return call.arguments.some((argument) => argument === fn) && isGeneratorRunner(call.callee);
}

const DIRECT_RUNNERS: ReadonlySet<string> = new Set(["gen", "fn", "fnUntraced"]);

// `Effect.gen(...)`, `Effect.fn(...)`, `Effect.fnUntraced(...)`, and the
// `Effect.fn("name")(...)` call that wraps a named body.
function isGeneratorRunner(callee: TSESTree.Expression): boolean {
  if (callee.type === AST_NODE_TYPES.CallExpression) {
    return effectMemberName(callee.callee) === "fn";
  }
  const name = effectMemberName(callee);
  return name !== null && DIRECT_RUNNERS.has(name);
}

function effectMemberName(node: TSESTree.Node): string | null {
  const member = getStaticMemberExpression(node);
  if (
    member === null ||
    member.object.type !== AST_NODE_TYPES.Identifier ||
    member.object.name !== "Effect"
  ) {
    return null;
  }
  return member.property.name;
}
