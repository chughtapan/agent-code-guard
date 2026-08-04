/**
 * @file Detects direct, aliased, and required `process.env` reads at runtime,
 * reserving configuration access for boundary initialization.
 */

import { AST_NODE_TYPES, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { getStaticStringKey } from "../utils/ast-refinement/index.js";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

function resolveLiteralStringValue(node: { type: string; value?: unknown } | null): string | null {
  return node?.type === AST_NODE_TYPES.Literal && typeof node.value === "string"
    ? node.value
    : null;
}

interface ScopeLookup {
  getScope(node: TSESTree.Node): TSESLint.Scope.Scope;
}

function resolveVariable(
  sourceCode: ScopeLookup,
  identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | null {
  let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable) {
      return variable;
    }
    scope = scope.upper;
  }
  return null;
}

function variableTargetsProcessModule(variable: TSESLint.Scope.Variable): boolean {
  return variable.defs.some(variableDefTargetsProcessModule);
}

function variableDefTargetsProcessModule(def: TSESLint.Scope.Definition): boolean {
  if (def.type === "ImportBinding") {
    return def.parent.type === AST_NODE_TYPES.ImportDeclaration
      ? resolveProcessSource(def.parent.source)
      : false;
  }
  if (def.type !== "Variable") {
    return false;
  }
  return resolveProcessInitializer(def.node.init);
}

function resolveProcessInitializer(init: TSESTree.Node | null): boolean {
  if (init?.type !== AST_NODE_TYPES.CallExpression) {
    return false;
  }
  if (!isRequireIdentifier(init.callee)) {
    return false;
  }
  const firstArgument = init.arguments[0];
  if (firstArgument == null || firstArgument.type === AST_NODE_TYPES.SpreadElement) {
    return false;
  }
  return resolveProcessSource(firstArgument);
}

function isRequireIdentifier(node: TSESTree.CallExpression["callee"]): boolean {
  return node.type === AST_NODE_TYPES.Identifier && node.name === "require";
}

function resolveProcessSource(node: { type: string; value?: unknown } | null): boolean {
  const source = resolveLiteralStringValue(node);
  return source === "node:process" || source === "process";
}

function isProcessReference(sourceCode: ScopeLookup, identifier: TSESTree.Identifier): boolean {
  if (identifier.name !== "process") {
    return false;
  }
  const variable = resolveVariable(sourceCode, identifier);
  return variable === null || variable.defs.length === 0 || variableTargetsProcessModule(variable);
}

function isProcessEnvAccess(sourceCode: ScopeLookup, node: TSESTree.MemberExpression): boolean {
  return (
    node.object.type === AST_NODE_TYPES.Identifier &&
    isProcessReference(sourceCode, node.object) &&
    getStaticStringKey(node.property, node.computed) === "env"
  );
}

/**
 * Enforces the `no-process-env-at-runtime` Agent Code Guard rule.
 */
export const noProcessEnvAtRuntime = createRule({
  name: "no-process-env-at-runtime",
  meta: {
    type: "problem",
    docs: {
      description:
        "Reading `process.env.X` outside boot bypasses the env schema; environment is a boundary, validated at boot.",
      url: PRINCIPLE_URL.VALIDATE_AT_BOUNDARY,
    },
    messages: {
      noProcessEnvAtRuntime:
        "Runtime `process.env` access — read config at the boundary with `Effect.Config` or inject a typed config object instead of touching `process.env` in application code.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    const { sourceCode } = context;

    return {
      MemberExpression(node) {
        if (!isProcessEnvAccess(sourceCode, node)) {
          return;
        }
        context.report({ node, messageId: "noProcessEnvAtRuntime" });
      },
    };
  },
});
