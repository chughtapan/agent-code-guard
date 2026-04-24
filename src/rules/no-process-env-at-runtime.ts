import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { getStaticStringKey } from "../utils/ast-refinement.js";

function getLiteralStringValue(node: { type: string; value?: unknown } | null): string | null {
  return node?.type === AST_NODE_TYPES.Literal && typeof node.value === "string"
    ? node.value
    : null;
}

interface ScopeLookup {
  getScope(node: TSESTree.Node): unknown;
}

interface VariableDefLike {
  readonly type: string;
  readonly parent?:
    | {
        readonly source?: { readonly type: string; readonly value?: unknown };
      }
    | null;
  readonly node: {
    readonly init?: TSESTree.Node | null;
  };
}

interface VariableLike {
  readonly defs: readonly VariableDefLike[];
}

interface ScopeLike {
  readonly upper: ScopeLike | null;
  readonly set: ReadonlyMap<string, VariableLike>;
}

function resolveVariable(
  sourceCode: ScopeLookup,
  identifier: TSESTree.Identifier,
): VariableLike | null {
  for (
    let scope = sourceCode.getScope(identifier) as ScopeLike | null;
    scope !== null;
    scope = scope.upper
  ) {
    const variable = scope.set.get(identifier.name);
    if (variable) return variable;
  }
  return null;
}

function variableTargetsProcessModule(variable: VariableLike): boolean {
  return variable.defs.some((def) => {
    if (def.type === "ImportBinding") {
      const source = getLiteralStringValue(def.parent?.source ?? null);
      return source === "node:process" || source === "process";
    }

    if (def.type !== "Variable") {
      return false;
    }

    const init = def.node.init;
    if (
      init?.type !== AST_NODE_TYPES.CallExpression ||
      init.callee.type !== AST_NODE_TYPES.Identifier ||
      init.callee.name !== "require"
    ) {
      return false;
    }

    const firstArgument = init.arguments[0];
    if (firstArgument == null || firstArgument.type === AST_NODE_TYPES.SpreadElement) {
      return false;
    }
    const source = getLiteralStringValue(firstArgument);
    return source === "node:process" || source === "process";
  });
}

function isProcessReference(
  sourceCode: ScopeLookup,
  identifier: TSESTree.Identifier,
): boolean {
  if (identifier.name !== "process") return false;
  const variable = resolveVariable(sourceCode, identifier);
  return (
    variable === null ||
    variable.defs.length === 0 ||
    variableTargetsProcessModule(variable)
  );
}

function isProcessEnvAccess(
  sourceCode: ScopeLookup,
  node: TSESTree.MemberExpression,
): boolean {
  return (
    node.object.type === AST_NODE_TYPES.Identifier &&
    isProcessReference(sourceCode, node.object) &&
    getStaticStringKey(node.property, node.computed) === "env"
  );
}

export default createRule({
  name: "no-process-env-at-runtime",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag runtime `process.env` access in application code. Read configuration at the boundary and pass typed values inward.",
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
        if (!isProcessEnvAccess(sourceCode, node)) return;
        context.report({ node, messageId: "noProcessEnvAtRuntime" });
      },
    };
  },
});
