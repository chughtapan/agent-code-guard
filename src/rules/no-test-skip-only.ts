import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const TEST_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /[\\/]tests?[\\/]/,
];

function isTestFile(filename: string): boolean {
  return TEST_FILE_PATTERNS.some((p) => p.test(filename));
}

const TEST_FNS = new Set(["it", "test", "describe"]);
const MODIFIERS = new Set(["skip", "only"]);
const ALIASES: Record<string, "skip"> = {
  xit: "skip",
  xtest: "skip",
  xdescribe: "skip",
};

export type Modifier = "skip" | "only";

export interface Options {
  allow?: Modifier[];
}

export default createRule<[Options], "skipOrOnly">({
  name: "no-test-skip-only",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flag `it.skip`, `it.only`, `describe.skip`, `describe.only`, `test.skip`, `test.only`, `xit`, `xdescribe`, `xtest` in committed tests.",
    },
    messages: {
      skipOrOnly:
        "no `.{{modifier}}` in committed tests; commit a passing test or delete it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: {
            type: "array",
            items: { type: "string", enum: ["skip", "only"] },
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
  create(context, [options]) {
    if (!isTestFile(context.filename)) return {};
    const allowed = new Set<Modifier>(options.allow ?? []);
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === AST_NODE_TYPES.Identifier) {
          const mod = ALIASES[callee.name];
          if (!mod) return;
          if (allowed.has(mod)) return;
          context.report({
            node: callee,
            messageId: "skipOrOnly",
            data: { modifier: mod },
          });
          return;
        }
        if (callee.type !== AST_NODE_TYPES.MemberExpression) return;
        if (callee.computed) return;
        if (
          callee.object.type !== AST_NODE_TYPES.Identifier ||
          !TEST_FNS.has(callee.object.name)
        ) {
          return;
        }
        if (callee.property.type !== AST_NODE_TYPES.Identifier) return;
        const prop = callee.property.name;
        if (!MODIFIERS.has(prop)) return;
        const mod = prop as Modifier;
        if (allowed.has(mod)) return;
        context.report({
          node: callee,
          messageId: "skipOrOnly",
          data: { modifier: mod },
        });
      },
    };
  },
});
