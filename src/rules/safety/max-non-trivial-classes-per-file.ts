import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

type Options = readonly [{ readonly max?: number; readonly factories?: readonly string[] }?];

const DEFAULT_MAX = 1;

// Default exemption list covers Effect's tag-class factories. Override
// via the `factories` rule option to add custom factories from other
// frameworks.
const DEFAULT_TAG_CLASS_FACTORIES: readonly string[] = [
  "Data.TaggedError",
  "Data.TaggedClass",
  "Data.Class",
  "Data.Error",
  "Schema.Class",
  "Schema.TaggedClass",
  "Schema.TaggedError",
  "Schema.TaggedRequest",
  "Context.Tag",
  "Context.Reference",
  "Effect.Service",
  "Effect.Tag",
];

function factoryMemberName(node: TSESTree.Expression): string | null {
  let current: TSESTree.Expression | TSESTree.Super = node;
  while (current.type === AST_NODE_TYPES.CallExpression) {
    current = current.callee;
  }
  if (current.type !== AST_NODE_TYPES.MemberExpression) return null;
  if (current.computed) return null;
  if (current.object.type !== AST_NODE_TYPES.Identifier) return null;
  if (current.property.type !== AST_NODE_TYPES.Identifier) return null;
  return `${current.object.name}.${current.property.name}`;
}

function extendsTagClassFactory(
  node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
  factories: ReadonlySet<string>,
): boolean {
  if (node.superClass === null) return false;
  const factory = factoryMemberName(node.superClass);
  return factory !== null && factories.has(factory);
}

export default createRule<Options, "tooMany">({
  name: "max-non-trivial-classes-per-file",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Cap classes per file. Classes that extend a configured tag-class factory (default: Effect's Data.TaggedError / Context.Tag / Effect.Service / Schema.Class / …) are exempt so co-located error/tag groups don't fight the limit.",
    },
    messages: {
      tooMany:
        "File defines {{count}} non-trivial classes; max is {{max}}. Classes extending configured tag-class factories are exempt — split real implementations across files.",
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "integer", minimum: 1 },
          factories: {
            type: "array",
            items: { type: "string", minLength: 1 },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [{ max: DEFAULT_MAX, factories: DEFAULT_TAG_CLASS_FACTORIES }],
  create(context, [options]) {
    const max = options?.max ?? DEFAULT_MAX;
    const factories = new Set(options?.factories ?? DEFAULT_TAG_CLASS_FACTORIES);
    const offenders: (TSESTree.ClassDeclaration | TSESTree.ClassExpression)[] = [];

    const visit = (
      node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    ): void => {
      if (!extendsTagClassFactory(node, factories)) offenders.push(node);
    };

    return {
      ClassDeclaration: visit,
      ClassExpression: visit,
      "Program:exit"() {
        if (offenders.length <= max) return;
        for (const node of offenders.slice(max)) {
          context.report({
            node,
            messageId: "tooMany",
            data: { count: offenders.length, max },
          });
        }
      },
    };
  },
});
