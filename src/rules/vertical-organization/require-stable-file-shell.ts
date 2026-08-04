/**
 * @file Enforces a canonical byte-zero-safe `@file` overview and contiguous
 * import shell, with explicit barriers for bare side-effect imports.
 */

import { AST_NODE_TYPES, type TSESTree, type TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import { type ParsedJsdocBlock, parseJsdocBlocks } from "./jsdoc-fragments.js";
import {
  type BareImportBarrierMessageId,
  hasLineAdjacentGap,
  parseSideEffectImportBarrier,
  reportBareImportBarrierViolations,
} from "./side-effect-import-barriers.js";

const LICENSE_PREFIX = /^(SPDX-License-Identifier:|SPDX-FileCopyrightText:|Copyright|©)/u;
// eslint-disable-next-line sonarjs/regex-complexity -- This is the bounded TypeScript triple-slash directive grammar.
const TRIPLE_SLASH_DIRECTIVE = /^\/\/\/\s*<(?:reference\s+(?:path|types|lib)=(?:"[^"]+"|'[^']+')|amd-module\s+name=(?:"[^"]+"|'[^']+')|amd-dependency\s+path=(?:"[^"]+"|'[^']+'))\s*\/?>(?:\s*)$/u;

type MessageIds =
  | "missingCanonicalFileOverview"
  | "multipleCanonicalFileOverviews"
  | "duplicateFileTag"
  | "disallowedPreamble"
  | "contentBeforeFileOverview"
  | "importShellInterrupted"
  | BareImportBarrierMessageId;

type ShellContext = Readonly<TSESLint.RuleContext<MessageIds, readonly []>>;
type ImportShellState = "preamble" | "imports" | "after";

interface OverviewPhaseOptions {
  readonly context: ShellContext;
  readonly sourceCode: TSESLint.SourceCode;
  readonly program: TSESTree.Program;
  readonly overview?: ParsedJsdocBlock;
}

function raw(sourceCode: TSESLint.SourceCode, token: TSESLint.AST.Token): string {
  return sourceCode.text.slice(token.range[0], token.range[1]);
}

function isLicenseComment(token: TSESLint.AST.Token): boolean {
  const text = token.value
    .split(/\r?\n/u)
    .map((line) => {
      const trimmed = line.trim();
      return trimmed.startsWith("*") ? trimmed.slice(1) : trimmed;
    })
    .find((line) => line !== "");
  return text !== undefined && LICENSE_PREFIX.test(text.trim());
}

function reportIndex(
  context: ShellContext,
  messageId: "disallowedPreamble" | "contentBeforeFileOverview",
  index: number,
): void {
  const loc = context.sourceCode.getLocFromIndex(index);
  context.report({ loc: { start: loc, end: loc }, messageId });
}

function canonicalBlocks(blocks: readonly ParsedJsdocBlock[]): readonly ParsedJsdocBlock[] {
  return blocks.filter((block) => {
    const files = block.tags.filter((tag) => tag.tag === "file");
    if (files.length !== 1) {
      return false;
    }
    const description = files[0].description;
    return description !== undefined;
  });
}

function firstUnpermittedPreamble(
  sourceCode: TSESLint.SourceCode,
  overview: ParsedJsdocBlock,
): number | undefined {
  const text = sourceCode.text;
  if (sourceCode.hasBOM) {
    return 0;
  }
  const comments = sourceCode.getAllComments();
  // eslint-disable-next-line agent-code-guard/require-assertion-rationale -- Parsed JSDoc tokens originate from getAllComments and are therefore comments.
  const overviewComment = overview.token as TSESTree.Comment;
  const overviewIndex = comments.indexOf(overviewComment);
  const allowed = comments
    .slice(0, overviewIndex)
    .filter((comment) => isLicenseComment(comment))
    .map((comment) => comment.range);
  if (text.startsWith("#!")) {
    const end = text.indexOf("\n");
    allowed.push([0, end] as const);
  }
  allowed.sort((left, right) => left[0] - right[0]);
  const relevant = allowed;
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
  if (node.type !== AST_NODE_TYPES.ExpressionStatement) {
    return false;
  }
  return node.directive !== undefined;
}

function isTripleSlashDirective(sourceCode: TSESLint.SourceCode, token: TSESLint.AST.Token): boolean {
  return TRIPLE_SLASH_DIRECTIVE.test(raw(sourceCode, token));
}

function statementAfterToken(
  sourceCode: TSESLint.SourceCode,
  program: TSESTree.Program,
  token: TSESLint.AST.Token,
): TSESTree.ProgramStatement | undefined {
  const followingToken = sourceCode.getTokenAfter(token);
  return program.body.find((statement) => sourceCode.getFirstToken(statement) === followingToken);
}

function statementBeforeToken(
  sourceCode: TSESLint.SourceCode,
  program: TSESTree.Program,
  token: TSESLint.AST.Token,
): TSESTree.ProgramStatement | undefined {
  const precedingToken = sourceCode.getTokenBefore(token);
  return program.body.find((statement) => sourceCode.getLastToken(statement) === precedingToken);
}

function beginsImmediateBareSideEffectImport(
  sourceCode: TSESLint.SourceCode,
  program: TSESTree.Program,
  comment: TSESLint.AST.Token,
): boolean {
  const marker = parseSideEffectImportBarrier(sourceCode, comment);
  if (marker?.kind !== "begin") {
    return false;
  }
  const following = statementAfterToken(sourceCode, program, comment);
  return following?.type === AST_NODE_TYPES.ImportDeclaration &&
    following.specifiers.length === 0 &&
    hasLineAdjacentGap(sourceCode, comment, following);
}

function reportInterimComments(
  context: ShellContext,
  program: TSESTree.Program,
  overview: ParsedJsdocBlock,
): void {
  const firstAfterOverview = statementAfterToken(context.sourceCode, program, overview.token);
  const statementsAfterOverview = firstAfterOverview === undefined
    ? []
    : program.body.slice(program.body.indexOf(firstAfterOverview));
  const firstContent = statementsAfterOverview.find((statement) => !directiveExpression(statement));
  if (firstContent?.type !== AST_NODE_TYPES.ImportDeclaration) {
    return;
  }
  const commentsBeforeContent = new Set(context.sourceCode.getCommentsBefore(firstContent));
  for (const comment of context.sourceCode.getCommentsAfter(overview.token)) {
    if (
      commentsBeforeContent.has(comment) &&
      !isTripleSlashDirective(context.sourceCode, comment) &&
      !beginsImmediateBareSideEffectImport(context.sourceCode, program, comment)
    ) {
      reportIndex(context, "disallowedPreamble", comment.range[0]);
    }
  }
}

function reportOverviewViolations(
  context: ShellContext,
  sourceCode: TSESLint.SourceCode,
  program: TSESTree.Program,
  blocks: readonly ParsedJsdocBlock[],
): ParsedJsdocBlock | undefined {
  const canonical = canonicalBlocks(blocks);
  const canonicalTags = new Set(canonical.flatMap((block) => block.tags));
  const allFileTags = blocks.flatMap((block) => block.tags.filter((tag) => tag.tag === "file"));
  const firstFileTag = allFileTags.at(0);
  for (const tag of allFileTags) {
    if (tag !== firstFileTag && !canonicalTags.has(tag)) {
      context.report({ loc: tag.description?.loc ?? tag.loc, messageId: "duplicateFileTag" });
    }
  }
  if (canonical.length === 0) {
    context.report({ node: program, messageId: "missingCanonicalFileOverview" });
  }
  for (const block of canonical.slice(1)) {
    context.report({ loc: sourceCode.getLocFromIndex(block.token.range[0]), messageId: "multipleCanonicalFileOverviews" });
  }
  return canonical.at(0);
}

function reportOverviewPreambleViolations(options: OverviewPhaseOptions): void {
  const { context, overview, program, sourceCode } = options;
  if (overview === undefined) {
    return;
  }
  const illegalPreamble = firstUnpermittedPreamble(sourceCode, overview);
  if (illegalPreamble !== undefined) {
    reportIndex(context, "disallowedPreamble", illegalPreamble);
  }
  const statementBeforeOverview = statementBeforeToken(sourceCode, program, overview.token);
  if (statementBeforeOverview !== undefined) {
    reportIndex(context, "contentBeforeFileOverview", statementBeforeOverview.range[0]);
  }
  reportInterimComments(context, program, overview);
}

function nextImportShellState(
  context: ShellContext,
  statement: TSESTree.ProgramStatement,
  state: ImportShellState,
): ImportShellState {
  if (statement.type !== AST_NODE_TYPES.ImportDeclaration) {
    return "after";
  }
  if (state === "after") {
    context.report({ node: statement, messageId: "importShellInterrupted" });
  }
  return "imports";
}

function reportImportShellViolations(options: OverviewPhaseOptions): void {
  const { context, overview, program, sourceCode } = options;
  let state: ImportShellState = "preamble";
  const firstAfterOverview = overview === undefined
    ? program.body.at(0)
    : statementAfterToken(sourceCode, program, overview.token);
  const firstAfterIndex = firstAfterOverview === undefined ? program.body.length : program.body.indexOf(firstAfterOverview);
  for (const statement of program.body.slice(firstAfterIndex)) {
    if (!directiveExpression(statement)) {
      state = nextImportShellState(context, statement, state);
    }
  }
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
        const overview = reportOverviewViolations(context, sourceCode, program, parseJsdocBlocks(sourceCode));
        const overviewOptions = { context, sourceCode, program, overview };
        reportOverviewPreambleViolations(overviewOptions);
        reportImportShellViolations(overviewOptions);
        reportBareImportBarrierViolations({
          sourceCode,
          program,
          report(statement, messageId) {
            context.report({ node: statement, messageId });
          },
        });
      },
    };
  },
});
