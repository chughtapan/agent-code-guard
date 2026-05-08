import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

const CLI_FILE_PATTERNS = [
  /(^|[\\/])cli[\\/]/,
  /(^|[\\/])bin[\\/]/,
  /(^|[\\/])cli\.[cm]?[jt]sx?$/,
];

const CONSOLE_METHODS = new Set([
  "log",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
]);

function isCliFile(filename: string): boolean {
  return CLI_FILE_PATTERNS.some((p) => p.test(filename));
}

function importsEffect(source: string): boolean {
  return source === "effect" || source.startsWith("@effect/");
}

function consoleMethodFromCall(node: TSESTree.CallExpression): string | null {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  const callee = node.callee;
  if (callee.computed) return null;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return null;
  if (callee.object.name !== "console") return null;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return null;
  if (!CONSOLE_METHODS.has(callee.property.name)) return null;
  return callee.property.name;
}

export default createRule({
  name: "no-console-in-effect",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag console.* calls in files importing Effect. Use Effect.log, Effect.logDebug, or a Logger service.",
    },
    messages: {
      consoleInEffect:
        "console.{{method}} in an Effect file; use Effect.log/logDebug/logError or a Logger service",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    if (isCliFile(context.filename)) return {};
    let foundEffectImport = false;
    const consoleCalls: { node: TSESTree.CallExpression; method: string }[] = [];
    return {
      ImportDeclaration(node) {
        if (typeof node.source.value === "string" && importsEffect(node.source.value)) {
          foundEffectImport = true;
        }
      },
      CallExpression(node) {
        const method = consoleMethodFromCall(node);
        if (method === null) return;
        consoleCalls.push({ node, method });
      },
      "Program:exit"() {
        if (!foundEffectImport) return;
        for (const { node, method } of consoleCalls) {
          context.report({
            node,
            messageId: "consoleInEffect",
            data: { method },
          });
        }
      },
    };
  },
});
