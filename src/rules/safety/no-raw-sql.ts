import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { getFirst } from "../../utils/ast-refinement/index.js";

const SQL_KEYWORD_RE = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i;

function stringLooksLikeSql(value: string): boolean {
  return SQL_KEYWORD_RE.test(value);
}

function literalLooksLikeSql(arg: TSESTree.CallExpressionArgument): boolean {
  return arg.type === AST_NODE_TYPES.Literal &&
    typeof arg.value === "string" &&
    stringLooksLikeSql(arg.value);
}

function templateLiteralLooksLikeSql(arg: TSESTree.CallExpressionArgument): boolean {
  if (arg.type !== AST_NODE_TYPES.TemplateLiteral) return false;
  const head = getFirst(arg.quasis);
  return head !== null && stringLooksLikeSql(head.value.raw);
}

function taggedTemplateLooksLikeSql(arg: TSESTree.CallExpressionArgument): boolean {
  return arg.type === AST_NODE_TYPES.TaggedTemplateExpression &&
    arg.tag.type === AST_NODE_TYPES.Identifier &&
    (arg.tag.name === "sql" || arg.tag.name === "SQL");
}

function firstArgLooksLikeSql(arg: TSESTree.CallExpressionArgument): boolean {
  return literalLooksLikeSql(arg) ||
    templateLiteralLooksLikeSql(arg) ||
    taggedTemplateLooksLikeSql(arg);
}

export default createRule({
  name: "no-raw-sql",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag raw SQL passed to `.query(...)` calls. Use a query builder like Kysely with typed results instead.",
    },
    messages: {
      rawSql:
        "Raw SQL in .query() — use a query builder (e.g. Kysely) with typed results",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== AST_NODE_TYPES.MemberExpression) return;
        const prop = callee.property;
        if (
          prop.type !== AST_NODE_TYPES.Identifier ||
          prop.name !== "query" ||
          callee.computed
        ) {
          return;
        }
        const first = node.arguments[0];
        if (!first) return;
        if (!firstArgLooksLikeSql(first)) return;
        context.report({ node, messageId: "rawSql" });
      },
    };
  },
});
