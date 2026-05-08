import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

const BOOT_FILE_PATTERNS = [
  /(^|[\\/])bin[\\/]/,
  /(^|[\\/])cli[\\/]/,
  /(^|[\\/])(main|cli|index|bootstrap|server)\.[cm]?[jt]sx?$/,
  /\.config\.[cm]?[jt]sx?$/,
];

const LOGGER_CONFIG_METHODS = new Set([
  "withMinimumLogLevel",
  "withConsoleLog",
  "withConsoleError",
]);

function isBootFile(filename: string): boolean {
  return BOOT_FILE_PATTERNS.some((pattern) => pattern.test(filename));
}

function loggerConfigCall(node: TSESTree.CallExpression): string | null {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return null;
  const callee = node.callee;
  if (callee.computed) return null;
  if (callee.object.type !== AST_NODE_TYPES.Identifier) return null;
  if (callee.object.name !== "Logger") return null;
  if (callee.property.type !== AST_NODE_TYPES.Identifier) return null;
  if (!LOGGER_CONFIG_METHODS.has(callee.property.name)) return null;
  return callee.property.name;
}

export default createRule({
  name: "logger-config-at-boot",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag Logger.withMinimumLogLevel / withConsoleLog / withConsoleError calls outside boot files. Configure logging once at the entry point.",
    },
    messages: {
      loggerConfigAwayFromBoot:
        "Logger.{{method}} outside a boot file; move logger configuration to your entry (index/main/cli, bootstrap, or *.config.*) so it isn't reconfigured per request.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    if (isBootFile(context.filename)) return {};
    return {
      CallExpression(node) {
        const method = loggerConfigCall(node);
        if (method === null) return;
        context.report({
          node,
          messageId: "loggerConfigAwayFromBoot",
          data: { method },
        });
      },
    };
  },
});
