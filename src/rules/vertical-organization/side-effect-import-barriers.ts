import { AST_NODE_TYPES, type TSESTree, type TSESLint } from "@typescript-eslint/utils";

const BARRIER_PREFIX = "// agent-code-guard: side-effect-import-";
const BARRIER_SEPARATOR = " -- evaluation-order: ";

/** Identifies one bare-import barrier diagnostic. */
export type BareImportBarrierMessageId =
  | "missingSideEffectImportBeginBarrier"
  | "missingSideEffectImportEndBarrier"
  | "invalidSideEffectImportBarrier"
  | "mismatchedSideEffectImportBarrier";

/** Represents one valid side-effect import barrier. */
export interface SideEffectImportBarrier {
  readonly kind: "begin" | "end";
  readonly reason: string;
}

type ReportBarrierViolation = (
  statement: TSESTree.ImportDeclaration,
  messageId: BareImportBarrierMessageId,
) => void;

interface BarrierCandidate {
  readonly token?: TSESLint.AST.Token;
  readonly barrier?: SideEffectImportBarrier;
}

interface BarrierSideOptions {
  readonly sourceCode: TSESLint.SourceCode;
  readonly statement: TSESTree.ImportDeclaration;
  readonly candidate: BarrierCandidate;
  readonly report: ReportBarrierViolation;
}

interface BareImportOptions {
  readonly sourceCode: TSESLint.SourceCode;
  readonly program: TSESTree.Program;
  readonly report: ReportBarrierViolation;
}

function raw(sourceCode: TSESLint.SourceCode, token: TSESLint.AST.Token): string {
  return sourceCode.text.slice(token.range[0], token.range[1]);
}

/**
 * Parses an evaluation-order marker from a line comment.
 * @param sourceCode Source text for the current file.
 * @param token Candidate comment token.
 * @returns The parsed barrier when the comment follows the exact marker grammar.
 */
export function parseSideEffectImportBarrier(
  sourceCode: TSESLint.SourceCode,
  token: TSESLint.AST.Token,
): SideEffectImportBarrier | undefined {
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
  const reason = text.slice(separator + BARRIER_SEPARATOR.length).trim();
  return reason === "" ? undefined : { kind, reason };
}

/**
 * Tests whether two source elements occupy adjacent lines with whitespace only.
 * @param sourceCode Source text for the current file.
 * @param left Element on the preceding line.
 * @param left.range Physical source range of the preceding element.
 * @param right Element on the following line.
 * @param right.range Physical source range of the following element.
 * @returns Whether exactly one line boundary separates the elements.
 */
export function hasLineAdjacentGap(
  sourceCode: TSESLint.SourceCode,
  left: { readonly range: readonly [number, number] },
  right: { readonly range: readonly [number, number] },
): boolean {
  return /^[ \t]*\r?\n[ \t]*$/u.test(sourceCode.text.slice(left.range[1], right.range[0]));
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

function candidateFor(
  sourceCode: TSESLint.SourceCode,
  token?: TSESLint.AST.Token,
): BarrierCandidate {
  if (token === undefined) {
    return {};
  }
  const barrier = parseSideEffectImportBarrier(sourceCode, token);
  return barrier === undefined ? { token } : { token, barrier };
}

function reportBeginBarrierViolation(options: BarrierSideOptions): void {
  const { candidate, report, sourceCode, statement } = options;
  if (candidate.barrier === undefined ||
      !hasLineAdjacentGap(sourceCode, candidate.token ?? statement, statement)) {
    const messageId = candidate.token?.type === "Line"
      ? "invalidSideEffectImportBarrier"
      : "missingSideEffectImportBeginBarrier";
    report(statement, messageId);
    return;
  }
  if (candidate.barrier.kind !== "begin") {
    report(statement, "invalidSideEffectImportBarrier");
  }
}

function reportEndBarrierViolation(options: BarrierSideOptions): void {
  const { candidate, report, sourceCode, statement } = options;
  if (candidate.barrier === undefined ||
      !hasLineAdjacentGap(sourceCode, statement, candidate.token ?? statement)) {
    const messageId = candidate.token?.type === "Line"
      ? "invalidSideEffectImportBarrier"
      : "missingSideEffectImportEndBarrier";
    report(statement, messageId);
    return;
  }
  if (candidate.barrier.kind !== "end") {
    report(statement, "invalidSideEffectImportBarrier");
  }
}

function reportBareImportBarriers(
  options: BareImportOptions,
  statement: TSESTree.ImportDeclaration,
  tokens: readonly TSESLint.AST.Token[],
): void {
  const { report, sourceCode } = options;
  const begin = candidateFor(sourceCode, directTokenBefore(tokens, statement.range));
  const end = candidateFor(sourceCode, directTokenAfter(tokens, statement.range));
  reportBeginBarrierViolation({ sourceCode, statement, candidate: begin, report });
  reportEndBarrierViolation({ sourceCode, statement, candidate: end, report });
  if (begin.barrier?.kind === "begin" &&
      end.barrier?.kind === "end" &&
      begin.barrier.reason !== end.barrier.reason) {
    report(statement, "mismatchedSideEffectImportBarrier");
  }
}

/**
 * Reports barrier violations for every bare side-effect import in a program.
 * @param options Source, program, and diagnostic callback for the validation pass.
 */
export function reportBareImportBarrierViolations(options: BareImportOptions): void {
  const { program, sourceCode } = options;
  const tokens = [...sourceCode.getTokens(program), ...sourceCode.getAllComments()].sort(
    (left, right) => left.range[0] - right.range[0],
  );
  for (const statement of program.body) {
    if (statement.type === AST_NODE_TYPES.ImportDeclaration && statement.specifiers.length === 0) {
      reportBareImportBarriers(options, statement, tokens);
    }
  }
}
