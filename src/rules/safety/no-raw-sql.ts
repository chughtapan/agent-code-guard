import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../../utils/create-rule.js";
import { getFirst } from "../../utils/ast-refinement/index.js";

const SQL_KEYWORD_RE = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i;

interface Options {
  readonly recommend?: string;
}

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

export default createRule<[Options], "rawSql" | "rawSqlWith">({
  name: "no-raw-sql",
  meta: {
    type: "problem",
    docs: {
      description: "Flag raw SQL strings passed to `.query(...)` calls.",
    },
    messages: {
      rawSql: "Raw SQL in .query(); use a typed SQL boundary",
      rawSqlWith: "Raw SQL in .query(); use {{tool}} or another typed SQL boundary",
    },
    schema: [
      {
        type: "object",
        properties: {
          recommend: { type: "string" },
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
    const recommend = options?.recommend;
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
        if (recommend !== undefined && recommend !== "") {
          context.report({
            node,
            messageId: "rawSqlWith",
            data: { tool: recommend },
          });
        } else {
          context.report({ node, messageId: "rawSql" });
        }
      },
    };
  },
});
