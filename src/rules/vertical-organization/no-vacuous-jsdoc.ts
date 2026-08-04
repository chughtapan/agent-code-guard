import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import { type DescriptionSpan, type ParsedJsdocBlock, parseJsdocBlocks } from "./jsdoc-fragments.js";

const DESCRIPTION_TAGS = new Set([
  "param",
  "arg",
  "argument",
  "returns",
  "return",
  "property",
  "prop",
  "throws",
  "exception",
]);

const PLACEHOLDERS = new Set([
  "todo",
  "tbd",
  "fixme",
  "xxx",
  "n/a",
  "none",
  "unknown",
  "no description",
]);

const FIXED_TEMPLATES = new Set([
  "value supplied to the operation",
  "name of the operation",
  "re-exports the public api from current module",
  "protocol definition to process",
]);

function normalize(text: string): string {
  const collapsed = text.trim().replace(/\s+/gu, " ");
  const withoutPeriod = collapsed.endsWith(".") ? collapsed.slice(0, -1) : collapsed;
  return withoutPeriod.replace(/[A-Z]/gu, (letter) => letter.toLowerCase());
}

function values(candidates: ReadonlyArray<string | undefined>): readonly string[] {
  return candidates.filter((candidate): candidate is string => candidate !== undefined).map(normalize);
}

// eslint-disable-next-line complexity, sonarjs/cyclomatic-complexity -- The closed template grammar stays explicit for auditability.
function templateMatches(span: DescriptionSpan, block: ParsedJsdocBlock): boolean {
  const prose = normalize(span.text);
  if (FIXED_TEMPLATES.has(prose)) {
    return true;
  }
  const attachment = block.attachment;
  const namedTag = span.tagName;
  const callableCandidates = values([
    attachment?.callable === undefined ? undefined : attachment.symbol,
    attachment?.callable,
  ]);
  const resultCandidates = namedTag === undefined ? callableCandidates : values([namedTag]);
  if (resultCandidates.some((candidate) => prose === `the ${candidate} result`)) {
    return true;
  }
  const runtimeCandidates = namedTag === undefined
    ? values([attachment?.symbol, attachment?.callable])
    : values([namedTag]);
  if (runtimeCandidates.some((candidate) => prose === `provides the ${candidate} runtime value`)) {
    return true;
  }
  if (namedTag === undefined && callableCandidates.some((candidate) => prose === `executes the ${candidate} operation`)) {
    return true;
  }
  return attachment?.represents === true && attachment.symbol !== undefined && prose === `represents ${normalize(attachment.symbol)} values`;
}

function isVacuous(span: DescriptionSpan, block: ParsedJsdocBlock): boolean {
  const prose = normalize(span.text);
  return PLACEHOLDERS.has(prose) || templateMatches(span, block);
}

/** Rejects the finite, evidence-based grammar of JSDoc filler prose. */
export const noVacuousJsdoc = createRule({
  name: "no-vacuous-jsdoc",
  meta: {
    type: "problem",
    docs: {
      description: "Rejects known placeholder and mechanically-derived JSDoc filler without judging other prose.",
      url: PRINCIPLE_URL.DISCIPLINE,
    },
    messages: {
      vacuousBlockDescription: "JSDoc block description is a known vacuous placeholder or filler template.",
      vacuousTagDescription: "JSDoc tag description is a known vacuous placeholder or filler template.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      // eslint-disable-next-line sonarjs/cognitive-complexity -- Block and tag diagnostics use distinct locations and messages.
      "Program:exit"() {
        const sourceCode = context.sourceCode;
        for (const block of parseJsdocBlocks(sourceCode)) {
          if (block.description !== undefined && isVacuous(block.description, block)) {
            context.report({
              loc: block.description.loc,
              messageId: "vacuousBlockDescription",
            });
          }
          for (const tag of block.tags) {
            if (
              tag.description !== undefined &&
              DESCRIPTION_TAGS.has(tag.tag) &&
              isVacuous(tag.description, block)
            ) {
              context.report({
                loc: tag.description.loc,
                messageId: "vacuousTagDescription",
              });
            }
          }
        }
      },
    };
  },
});
