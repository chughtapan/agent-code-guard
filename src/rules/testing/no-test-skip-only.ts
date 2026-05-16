import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { isTestFile } from "../utils/is-test-file.js";
import { getStaticMemberPropertyName } from "../utils/ast-refinement/index.js";

const TEST_FNS = new Set(["it", "test", "describe"]);
const ALIASES: Record<string, "skip"> = {
  xit: "skip",
  xtest: "skip",
  xdescribe: "skip",
};

type Modifier = "skip" | "only";

type Options = {
  readonly allow?: readonly Modifier[];
};

function extractModifier(node: TSESTree.Node): Modifier | null {
  if (node.type !== AST_NODE_TYPES.MemberExpression) return null;
  const prop = getStaticMemberPropertyName(node);
  if (prop === null) return null;
  if (prop === "each") {
    return extractModifier(node.object);
  }
  return isModifier(prop) && memberObjectIsTestFn(node) ? prop : null;
}

function isModifier(value: string): value is Modifier {
  return value === "skip" || value === "only";
}

function memberObjectIsTestFn(node: TSESTree.MemberExpression): boolean {
  return node.object.type === AST_NODE_TYPES.Identifier &&
    TEST_FNS.has(node.object.name);
}

export default createRule<[Options], "skipOrOnly">({
  name: "no-test-skip-only",
  meta: {
    type: "problem",
    docs: {
      description: "Test-hygiene corollary of principle 1: a `.skip` or `.only` shipped to main is a test that does not test.",
      url: "https://github.com/chughtapan/safer-by-default/blob/main/PRINCIPLES.md#1-types-beat-tests--move-constraints-into-the-type-system",
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
        const mod = extractModifier(callee);
        if (mod) report(callee, mod);
      },
      // `` it.skip.each`a|b\n1|2`('...', fn) `` — Vitest's tagged-template table form.
      // The outer call's callee is a TaggedTemplateExpression; the MemberExpression
      // visit in `CallExpression` would miss it, so hook the tagged template directly.
      TaggedTemplateExpression(node) {
        const mod = extractModifier(node.tag);
        if (mod) report(node.tag, mod);
      },
    };
  },
});
