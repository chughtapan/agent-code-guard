import { AST_NODE_TYPES, type TSESTree, type TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import { type ParsedJsdocBlock, parseJsdocBlocks } from "./jsdoc-fragments.js";

const LICENSE_PREFIX = /^(SPDX-License-Identifier:|SPDX-FileCopyrightText:|Copyright|©)/u;
const BARRIER = /^\/\/[ \t]agent-code-guard: side-effect-import-(begin|end) -- evaluation-order: ([^\r\n]*\S[^\r\n]*)$/u;

type BarrierKind = "begin" | "end";

interface Barrier {
  readonly kind: BarrierKind;
  readonly reason: string;
}

function raw(sourceCode: TSESLint.SourceCode, token: TSESLint.AST.Token): string {
  return sourceCode.text.slice(token.range[0], token.range[1]);
}

function isLicenseComment(sourceCode: TSESLint.SourceCode, token: TSESLint.AST.Token): boolean {
  const text = raw(sourceCode, token)
    .replace(/^\/\*/u, "")
    .replace(/\*\/$/u, "")
    .replace(/^\/\//u, "")
    .trim();
  return LICENSE_PREFIX.test(text);
}

function barrier(sourceCode: TSESLint.SourceCode, token: TSESLint.AST.Token): Barrier | undefined {
  if (token.type !== "Line") {
    return undefined;
  }
  const match = BARRIER.exec(raw(sourceCode, token));
  if (match === null) {
    return undefined;
  }
  const kind = match[1];
  if (kind !== "begin" && kind !== "end") {
    return undefined;
  }
  return { kind, reason: match[2].trim() };
}

function reportIndex(
  context: Readonly<
    TSESLint.RuleContext<"disallowedPreamble" | "contentBeforeFileOverview", readonly []>
  >,
  messageId: "disallowedPreamble" | "contentBeforeFileOverview",
  index: number,
): void {
  const loc = context.sourceCode.getLocFromIndex(index);
  context.report({ loc: { start: loc, end: loc }, messageId });
}

function canonicalBlocks(blocks: readonly ParsedJsdocBlock[]): readonly ParsedJsdocBlock[] {
  return blocks.filter((block) => {
    const files = block.tags.filter((tag) => tag.tag === "file");
    return files.length === 1 && files[0].description !== undefined && files[0].description.text.trim() !== "";
  });
}

function firstUnpermittedPreamble(
  sourceCode: TSESLint.SourceCode,
  overview: ParsedJsdocBlock,
): number | undefined {
  const text = sourceCode.text;
  if (sourceCode.hasBOM || text.startsWith("\uFEFF")) {
    return 0;
  }
  const allowed = sourceCode
    .getAllComments()
    .filter((comment) => comment.range[1] <= overview.token.range[0] && isLicenseComment(sourceCode, comment))
    .map((comment) => comment.range);
  if (text.startsWith("#!")) {
    const end = text.indexOf("\n");
    allowed.push([0, end === -1 ? text.length : end] as const);
  }
  const relevant = allowed.sort((left, right) => left[0] - right[0]);
  let cursor = 0;
  for (const range of relevant) {
    const gap = text.slice(cursor, range[0]);
    const illegal = gap.search(/\S/u);
    if (illegal !== -1) {
      return cursor + illegal;
    }
    cursor = range[1];
  }
  const remaining = text.slice(cursor, overview.token.range[0]);
  const illegal = remaining.search(/\S/u);
  return illegal === -1 ? undefined : cursor + illegal;
}

function directiveExpression(node: TSESTree.ProgramStatement): boolean {
  return node.type === AST_NODE_TYPES.ExpressionStatement && node.directive !== undefined;
}

function directTokenBefore(
  tokens: readonly TSESLint.AST.Token[],
  range: readonly [number, number],
): TSESLint.AST.Token | undefined {
  return tokens.filter((token) => token.range[1] <= range[0]).at(-1);
}

function directTokenAfter(
  tokens: readonly TSESLint.AST.Token[],
  range: readonly [number, number],
): TSESLint.AST.Token | undefined {
  return tokens.find((token) => token.range[0] >= range[1]);
}

/** Enforces a canonical JSDoc overview, contiguous import shell, and paired bare-import barriers. */
export const requireStableFileShell = createRule({
  name: "require-stable-file-shell",
  meta: {
    type: "problem",
    docs: {
      description: "Requires one canonical @file overview and reasoned hard partitions around bare side-effect imports.",
      url: PRINCIPLE_URL.DISCIPLINE,
    },
    messages: {
      missingCanonicalFileOverview: "File requires exactly one canonical JSDoc @file overview.",
      multipleCanonicalFileOverviews: "File contains more than one canonical JSDoc @file overview.",
      duplicateFileTag: "A canonical JSDoc overview contains more than one @file tag.",
      disallowedPreamble: "Only a byte-zero hashbang and SPDX/copyright comments may precede the @file overview.",
      contentBeforeFileOverview: "Code or an import appears before the canonical @file overview.",
      importShellInterrupted: "Import declarations must form one contiguous shell after the overview preamble.",
      missingSideEffectImportBeginBarrier: "Bare side-effect import requires an immediately preceding evaluation-order begin barrier.",
      missingSideEffectImportEndBarrier: "Bare side-effect import requires an immediately following evaluation-order end barrier.",
      invalidSideEffectImportBarrier: "Side-effect import barriers must use the exact evaluation-order marker grammar.",
      mismatchedSideEffectImportBarrier: "Side-effect import begin and end barriers must state the identical evaluation-order reason.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    return {
      "Program:exit"(program: TSESTree.Program) {
        const sourceCode = context.sourceCode;
        const blocks = parseJsdocBlocks(sourceCode);
        const canonical = canonicalBlocks(blocks);
        const blocksWithDuplicateFileTags = blocks.filter(
          (block) => block.tags.filter((tag) => tag.tag === "file").length > 1,
        );
        for (const block of blocksWithDuplicateFileTags) {
          context.report({ loc: sourceCode.getLocFromIndex(block.token.range[0]), messageId: "duplicateFileTag" });
        }
        if (canonical.length === 0) {
          context.report({ node: program, messageId: "missingCanonicalFileOverview" });
        }
        if (canonical.length > 1) {
          for (const block of canonical.slice(1)) {
            context.report({ loc: sourceCode.getLocFromIndex(block.token.range[0]), messageId: "multipleCanonicalFileOverviews" });
          }
        }
        const overview = canonical.at(0);
        if (overview !== undefined) {
          const illegalPreamble = firstUnpermittedPreamble(sourceCode, overview);
          if (illegalPreamble !== undefined) {
            reportIndex(context, "disallowedPreamble", illegalPreamble);
          }
          for (const statement of program.body) {
            if (statement.range[0] < overview.token.range[0]) {
              reportIndex(context, "contentBeforeFileOverview", statement.range[0]);
              break;
            }
          }
        }

        let state: "preamble" | "imports" | "after" = "preamble";
        for (const statement of program.body) {
          if (overview !== undefined && statement.range[0] < overview.token.range[1]) {
            continue;
          }
          if (state === "preamble" && directiveExpression(statement)) {
            continue;
          }
          if (statement.type === AST_NODE_TYPES.ImportDeclaration) {
            if (state === "after") {
              context.report({ node: statement, messageId: "importShellInterrupted" });
            }
            state = "imports";
          } else if (state !== "preamble" || !directiveExpression(statement)) {
            state = "after";
          }
        }

        const lexicalTokens = [...sourceCode.getTokens(program), ...sourceCode.getAllComments()].sort(
          (left, right) => left.range[0] - right.range[0],
        );
        for (const statement of program.body) {
          if (statement.type !== AST_NODE_TYPES.ImportDeclaration || statement.specifiers.length !== 0) {
            continue;
          }
          const before = directTokenBefore(lexicalTokens, statement.range);
          const after = directTokenAfter(lexicalTokens, statement.range);
          const begin = before === undefined ? undefined : barrier(sourceCode, before);
          const end = after === undefined ? undefined : barrier(sourceCode, after);
          if (begin === undefined) {
            context.report({
              node: statement,
              messageId: before?.type === "Line" ? "invalidSideEffectImportBarrier" : "missingSideEffectImportBeginBarrier",
            });
          } else if (begin.kind !== "begin") {
            context.report({ node: statement, messageId: "invalidSideEffectImportBarrier" });
          }
          if (end === undefined) {
            context.report({
              node: statement,
              messageId: after?.type === "Line" ? "invalidSideEffectImportBarrier" : "missingSideEffectImportEndBarrier",
            });
          } else if (end.kind !== "end") {
            context.report({ node: statement, messageId: "invalidSideEffectImportBarrier" });
          }
          if (begin?.kind === "begin" && end?.kind === "end" && begin.reason !== end.reason) {
            context.report({ node: statement, messageId: "mismatchedSideEffectImportBarrier" });
          }
        }
      },
    };
  },
});
