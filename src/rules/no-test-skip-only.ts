import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const TEST_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /[\\/]tests?[\\/]/,
  /[\\/]__tests__[\\/]/,
  /[\\/]e2e[\\/]/,
];

function isTestFile(filename: string): boolean {
  return TEST_FILE_PATTERNS.some((p) => p.test(filename));
}

const TEST_FNS = new Set(["it", "test", "describe"]);
const ALIASES: Record<string, "skip"> = {
  xit: "skip",
  xtest: "skip",
  xdescribe: "skip",
};

export type Modifier = "skip" | "only";

export interface Options {
  allow?: Modifier[];
}

function extractModifier(node: TSESTree.Node): Modifier | null {
  if (node.type !== AST_NODE_TYPES.MemberExpression || node.computed) return null;
  if (node.property.type !== AST_NODE_TYPES.Identifier) return null;
  const prop = node.property.name;
  if (prop === "skip" || prop === "only") {
    if (
      node.object.type === AST_NODE_TYPES.Identifier &&
      TEST_FNS.has(node.object.name)
    ) {
      return prop;
    }
    return null;
  }
  // `it.skip.each([...])` / `describe.only.each([...])` — descend through `.each`
  if (prop === "each") {
    return extractModifier(node.object);
  }
  return null;
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

    function report(node: TSESTree.Node, mod: Modifier) {
      if (allowed.has(mod)) return;
      context.report({ node, messageId: "skipOrOnly", data: { modifier: mod } });
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type === AST_NODE_TYPES.Identifier) {
          const mod = ALIASES[callee.name];
          if (mod) report(callee, mod);
          return;
        }
        if (callee.type !== AST_NODE_TYPES.MemberExpression) return;
        const mod = extractModifier(callee);
        if (mod) report(callee, mod);
      },
      // `` it.skip.each`a|b\n1|2`('...', fn) `` — Vitest's tagged-template table form.
      // The outer call's callee is a TaggedTemplateExpression; the MemberExpression
      // visit in `CallExpression` would miss it, so hook the tagged template directly.
      TaggedTemplateExpression(node) {
        if (node.tag.type !== AST_NODE_TYPES.MemberExpression) return;
        const mod = extractModifier(node.tag);
        if (mod) report(node.tag, mod);
      },
    };
  },
});
