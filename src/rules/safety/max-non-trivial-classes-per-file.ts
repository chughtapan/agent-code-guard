import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

type Options = readonly [{ readonly max?: number }?];

const DEFAULT_MAX = 1;

const isTrivialClass = (
  node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
): boolean => node.body.body.length === 0;

export default createRule<Options, "tooMany">({
  name: "max-non-trivial-classes-per-file",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Cap classes per file, ignoring empty-bodied tag classes (Data.TaggedError, Schema.Class, Context.Tag, Effect.Service, …) that are co-located on purpose.",
    },
    messages: {
      tooMany:
        "File defines {{count}} non-trivial classes; max is {{max}}. Tag classes with empty bodies are exempt — split real implementations across files.",
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [{ max: DEFAULT_MAX }],
  create(context, [options]) {
    const max = options?.max ?? DEFAULT_MAX;
    const offenders: (TSESTree.ClassDeclaration | TSESTree.ClassExpression)[] = [];

    const visit = (
      node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    ): void => {
      if (!isTrivialClass(node)) offenders.push(node);
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
