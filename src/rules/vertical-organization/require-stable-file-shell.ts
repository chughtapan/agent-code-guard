import { AST_NODE_TYPES, type TSESTree, type TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import { type ParsedJsdocBlock, parseJsdocBlocks } from "./jsdoc-fragments.js";

const LICENSE_PREFIX = /^(SPDX-License-Identifier:|SPDX-FileCopyrightText:|Copyright|©)/u;
const BARRIER_PREFIX = "// agent-code-guard: side-effect-import-";
const BARRIER_SEPARATOR = " -- evaluation-order: ";
// eslint-disable-next-line sonarjs/regex-complexity -- This is the bounded TypeScript triple-slash directive grammar.
const TRIPLE_SLASH_DIRECTIVE = /^\/\/\/\s*<(?:reference\s+(?:path|types|lib)=(?:"[^"]+"|'[^']+')|amd-module\s+name=(?:"[^"]+"|'[^']+')|amd-dependency\s+path=(?:"[^"]+"|'[^']+'))\s*\/?>(?:\s*)$/u;

type BarrierKind = "begin" | "end";
type MessageIds =
  | "missingCanonicalFileOverview"
  | "multipleCanonicalFileOverviews"
  | "duplicateFileTag"
  | "disallowedPreamble"
  | "contentBeforeFileOverview"
  | "importShellInterrupted"
  | "missingSideEffectImportBeginBarrier"
  | "missingSideEffectImportEndBarrier"
  | "invalidSideEffectImportBarrier"
  | "mismatchedSideEffectImportBarrier";

type ShellContext = Readonly<TSESLint.RuleContext<MessageIds, readonly []>>;

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
    .replace(/^[ \t]*\*[ \t]?/gmu, "")
    .trim();
  return LICENSE_PREFIX.test(text);
}

function barrier(sourceCode: TSESLint.SourceCode, token: TSESLint.AST.Token): Barrier | undefined {
  if (token.type !== "Line") {
    return undefined;
  }
  const text = raw(sourceCode, token);
  if (!text.startsWith(BARRIER_PREFIX)) {
    return undefined;
  }
  const separator = text.indexOf(BARRIER_SEPARATOR, BARRIER_PREFIX.length);
  if (separator === -1) {
    return undefined;
  }
  const kind = text.slice(BARRIER_PREFIX.length, separator);
  if (kind !== "begin" && kind !== "end") {
    return undefined;
  }
  const reason = text.slice(separator + BARRIER_SEPARATOR.length);
  return reason.trim() === "" ? undefined : { kind, reason: reason.trim() };
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

function hasLineAdjacentGap(
  sourceCode: TSESLint.SourceCode,
  left: { readonly range: readonly [number, number] },
  right: { readonly range: readonly [number, number] },
): boolean {
  return /^[ \t]*\r?\n[ \t]*$/u.test(sourceCode.text.slice(left.range[1], right.range[0]));
}

function isTripleSlashDirective(sourceCode: TSESLint.SourceCode, token: TSESLint.AST.Token): boolean {
  return token.type === "Line" && TRIPLE_SLASH_DIRECTIVE.test(raw(sourceCode, token));
}

function beginsImmediateBareSideEffectImport(
  sourceCode: TSESLint.SourceCode,
  program: TSESTree.Program,
  comment: TSESLint.AST.Token,
): boolean {
  const marker = barrier(sourceCode, comment);
  if (marker?.kind !== "begin") {
    return false;
  }
  const following = program.body.find((statement) => statement.range[0] >= comment.range[1]);
  return following?.type === AST_NODE_TYPES.ImportDeclaration &&
    following.specifiers.length === 0 &&
    hasLineAdjacentGap(sourceCode, comment, following);
}

function reportInterimComments(
  context: ShellContext,
  program: TSESTree.Program,
  overview: ParsedJsdocBlock,
): void {
  const firstContent = program.body.find(
    (statement) => statement.range[0] >= overview.token.range[1] && !directiveExpression(statement),
  );
  if (firstContent?.type !== AST_NODE_TYPES.ImportDeclaration) {
    return;
  }
  for (const comment of context.sourceCode.getAllComments()) {
    if (
      comment.range[0] > overview.token.range[1] &&
      comment.range[1] < firstContent.range[0] &&
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
  const canonicalTags = new Set(canonical.flatMap((block) => block.tags.filter((tag) => tag.tag === "file")));
  const allFileTags = blocks.flatMap((block) => block.tags.filter((tag) => tag.tag === "file"));
  const firstFileTag = allFileTags.at(0);
  for (const tag of allFileTags) {
    if (tag !== firstFileTag && !canonicalTags.has(tag)) {
      context.report({ loc: tag.description?.loc ?? sourceCode.getLocFromIndex(0), messageId: "duplicateFileTag" });
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

function reportOverviewPreambleViolations(
  context: ShellContext,
  sourceCode: TSESLint.SourceCode,
  program: TSESTree.Program,
  overview: ParsedJsdocBlock | undefined,
): void {
  if (overview === undefined) {
    return;
  }
  const illegalPreamble = firstUnpermittedPreamble(sourceCode, overview);
  if (illegalPreamble !== undefined) {
    reportIndex(context, "disallowedPreamble", illegalPreamble);
  }
  const statementBeforeOverview = program.body.find((statement) => statement.range[0] < overview.token.range[0]);
  if (statementBeforeOverview !== undefined) {
    reportIndex(context, "contentBeforeFileOverview", statementBeforeOverview.range[0]);
  }
  reportInterimComments(context, program, overview);
}

function reportImportShellViolations(
  context: ShellContext,
  program: TSESTree.Program,
  overview: ParsedJsdocBlock | undefined,
): void {
  let state: "preamble" | "imports" | "after" = "preamble";
  for (const statement of program.body) {
    const precedesOverview = overview !== undefined && statement.range[0] < overview.token.range[1];
    const isPreambleDirective = state === "preamble" && directiveExpression(statement);
    if (!precedesOverview && !isPreambleDirective) {
      if (statement.type === AST_NODE_TYPES.ImportDeclaration) {
        if (state === "after") {
          context.report({ node: statement, messageId: "importShellInterrupted" });
        }
        state = "imports";
      } else {
        state = "after";
      }
    }
  }
}

function lexicalTokens(
  sourceCode: TSESLint.SourceCode,
  program: TSESTree.Program,
): readonly TSESLint.AST.Token[] {
  return [...sourceCode.getTokens(program), ...sourceCode.getAllComments()].sort(
    (left, right) => left.range[0] - right.range[0],
  );
}

function reportBareImportBarrierViolations(
  context: ShellContext,
  sourceCode: TSESLint.SourceCode,
  program: TSESTree.Program,
): void {
  const tokens = lexicalTokens(sourceCode, program);
  for (const statement of program.body) {
    if (statement.type === AST_NODE_TYPES.ImportDeclaration && statement.specifiers.length === 0) {
      reportBareImportBarriers(context, sourceCode, statement, tokens);
    }
  }
}

function reportBareImportBarriers(
  context: ShellContext,
  sourceCode: TSESLint.SourceCode,
  statement: TSESTree.ImportDeclaration,
  tokens: readonly TSESLint.AST.Token[],
): void {
  const before = directTokenBefore(tokens, statement.range);
  const after = directTokenAfter(tokens, statement.range);
  const begin = before === undefined ? undefined : barrier(sourceCode, before);
  const end = after === undefined ? undefined : barrier(sourceCode, after);
  reportBeginBarrierViolation(context, sourceCode, statement, before, begin);
  reportEndBarrierViolation(context, sourceCode, statement, after, end);
  if (begin?.kind === "begin" && end?.kind === "end" && begin.reason !== end.reason) {
    context.report({ node: statement, messageId: "mismatchedSideEffectImportBarrier" });
  }
}

function reportBeginBarrierViolation(
  context: ShellContext,
  sourceCode: TSESLint.SourceCode,
  statement: TSESTree.ImportDeclaration,
  before: TSESLint.AST.Token | undefined,
  begin: Barrier | undefined,
): void {
  if (begin === undefined || !hasLineAdjacentGap(sourceCode, before ?? statement, statement)) {
    context.report({
      node: statement,
      messageId: before?.type === "Line" ? "invalidSideEffectImportBarrier" : "missingSideEffectImportBeginBarrier",
    });
  } else if (begin.kind !== "begin") {
    context.report({ node: statement, messageId: "invalidSideEffectImportBarrier" });
  }
}

function reportEndBarrierViolation(
  context: ShellContext,
  sourceCode: TSESLint.SourceCode,
  statement: TSESTree.ImportDeclaration,
  after: TSESLint.AST.Token | undefined,
  end: Barrier | undefined,
): void {
  if (end === undefined || !hasLineAdjacentGap(sourceCode, statement, after ?? statement)) {
    context.report({
      node: statement,
      messageId: after?.type === "Line" ? "invalidSideEffectImportBarrier" : "missingSideEffectImportEndBarrier",
    });
  } else if (end.kind !== "end") {
    context.report({ node: statement, messageId: "invalidSideEffectImportBarrier" });
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
        reportOverviewPreambleViolations(context, sourceCode, program, overview);
        reportImportShellViolations(context, program, overview);
        reportBareImportBarrierViolations(context, sourceCode, program);
      },
    };
  },
});
