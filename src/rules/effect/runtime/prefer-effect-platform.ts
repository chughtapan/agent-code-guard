import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";

type Target = "fs" | "http" | "argv" | "fetch" | "sql" | "cli";

type Options = { readonly disable?: readonly Target[] };

const FS_MODULES = new Set(["fs", "node:fs", "fs/promises", "node:fs/promises"]);
const HTTP_MODULES = new Set(["http", "node:http", "https", "node:https"]);
const SQL_DRIVER_PATTERNS = [
  /^pg(\/|$)/,
  /^pg-promise(\/|$)/,
  /^mysql2?(\/|$)/,
  /^kysely(\/|$)/,
  /^drizzle-orm(\/|$)/,
  /^better-sqlite3(\/|$)/,
];
const CLI_LIB_PATTERNS = [
  /^yargs(\/|$)/,
  /^commander(\/|$)/,
];

function importsEffect(source: string): boolean {
  return source === "effect" || source.startsWith("@effect/");
}

function targetForImportSource(source: string): Target | null {
  if (FS_MODULES.has(source)) return "fs";
  if (HTTP_MODULES.has(source)) return "http";
  if (SQL_DRIVER_PATTERNS.some((p) => p.test(source))) return "sql";
  if (CLI_LIB_PATTERNS.some((p) => p.test(source))) return "cli";
  return null;
}

function isProcessArgvAccess(node: TSESTree.MemberExpression): boolean {
  if (node.computed) return false;
  if (node.object.type !== AST_NODE_TYPES.Identifier) return false;
  if (node.object.name !== "process") return false;
  if (node.property.type !== AST_NODE_TYPES.Identifier) return false;
  return node.property.name === "argv";
}

function isBareFetchCall(node: TSESTree.CallExpression): boolean {
  return node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === "fetch";
}

interface Pending {
  readonly node: TSESTree.Node;
  readonly target: Target;
  readonly module: string;
}

export default createRule<[Options], "rawFs" | "rawHttp" | "rawArgv" | "rawFetch" | "rawSql" | "rawCli">({
  name: "prefer-effect-platform",
  meta: {
    type: "problem",
    docs: {
      description:
        "In Effect files, prefer @effect/platform / @effect/sql / @effect/cli over raw Node modules and third-party clients.",
    },
    messages: {
      rawFs: "Raw `{{module}}` in an Effect file; use @effect/platform's FileSystem",
      rawHttp: "Raw `{{module}}` in an Effect file; use @effect/platform's HttpClient or HttpServer",
      rawArgv: "process.argv in an Effect file; use @effect/cli",
      rawFetch: "Bare fetch() in an Effect file; use @effect/platform's HttpClient",
      rawSql: "Raw SQL client `{{module}}` in an Effect file; use @effect/sql",
      rawCli: "Raw CLI library `{{module}}` in an Effect file; use @effect/cli",
    },
    schema: [
      {
        type: "object",
        properties: {
          disable: {
            type: "array",
            items: {
              type: "string",
              enum: ["fs", "http", "argv", "fetch", "sql", "cli"],
            },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [{}],
  create(context) {
    const [options] = context.options;
    const disabled = new Set<Target>(options?.disable ?? []);
    let foundEffectImport = false;
    const pending: Pending[] = [];

    function targetEnabled(target: Target): boolean {
      return !disabled.has(target);
    }

    return {
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;
        if (importsEffect(source)) {
          foundEffectImport = true;
          return;
        }
        const target = targetForImportSource(source);
        if (target === null) return;
        if (!targetEnabled(target)) return;
        pending.push({ node, target, module: source });
      },
      MemberExpression(node) {
        if (!isProcessArgvAccess(node)) return;
        if (!targetEnabled("argv")) return;
        pending.push({ node, target: "argv", module: "process.argv" });
      },
      CallExpression(node) {
        if (!isBareFetchCall(node)) return;
        if (!targetEnabled("fetch")) return;
        pending.push({ node, target: "fetch", module: "fetch" });
      },
      "Program:exit"() {
        if (!foundEffectImport) return;
        for (const { node, target, module } of pending) {
          context.report({
            node,
            messageId: messageIdFor(target),
            data: { module },
          });
        }
      },
    };
  },
});

function messageIdFor(target: Target): "rawFs" | "rawHttp" | "rawArgv" | "rawFetch" | "rawSql" | "rawCli" {
  switch (target) {
    case "fs":
      return "rawFs";
    case "http":
      return "rawHttp";
    case "argv":
      return "rawArgv";
    case "fetch":
      return "rawFetch";
    case "sql":
      return "rawSql";
    case "cli":
      return "rawCli";
  }
}
