import ts from "typescript";
import { Schema } from "effect";
import {
  ARCHITECTURE_DIAGNOSTIC_RULE_IDS,
  type ArchitectureDiagnosticRuleId,
} from "./rule-ids.js";

const DIRECTIVE_MARKER = "@agent-code-guard/architecture-exception";
const RULE_ID_SET: ReadonlySet<string> = new Set(ARCHITECTURE_DIAGNOSTIC_RULE_IDS);

export const ArchitectureDirective = Schema.Struct({
  ruleId: Schema.Literal(...ARCHITECTURE_DIAGNOSTIC_RULE_IDS),
  reason: Schema.String.pipe(Schema.minLength(1)),
});
export type ArchitectureDirective = typeof ArchitectureDirective.Type;

export interface FileDirectives {
  readonly file: string;
  readonly directives: ReadonlyArray<ArchitectureDirective>;
}

export interface DirectiveParseError {
  readonly file: string;
  readonly line: number;
  readonly ruleId: ArchitectureDiagnosticRuleId | null;
  readonly message: string;
}

export interface DirectiveParseResult {
  readonly directives: ReadonlyArray<ArchitectureDirective>;
  readonly errors: ReadonlyArray<DirectiveParseError>;
}

const missingReasonError = (
  filePath: string,
  line: number,
  ruleId: ArchitectureDiagnosticRuleId,
): DirectiveParseError => ({
  file: filePath,
  line,
  ruleId,
  message: `Directive '${DIRECTIVE_MARKER}: ${ruleId}' is missing a 'reason:' follow-up line.`,
});

// Read directives from a TypeScript source file's leading comment block.
// Uses ts.getLeadingCommentRanges so we don't have to hand-roll comment
// recognition or split the file text.
export function parseDirectivesFromSourceFile(
  sourceFile: ts.SourceFile,
): DirectiveParseResult {
  const text = sourceFile.text;
  const ranges = ts.getLeadingCommentRanges(text, 0) ?? [];
  const lineOf = (pos: number) =>
    ts.getLineAndCharacterOfPosition(sourceFile, pos).line + 1;

  const commentLines: Array<{ line: number; content: string }> = [];
  for (const range of ranges) {
    const raw = text.slice(range.pos, range.end);
    if (range.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
      const startLine = lineOf(range.pos);
      commentLines.push({ line: startLine, content: stripLineComment(raw) });
      continue;
    }
    // Block comment: split inner lines, strip leading * adornments.
    const inner = raw.replace(/^\/\*+/, "").replace(/\*+\/$/, "");
    const lines = inner.split(/\r?\n/);
    let cursor = lineOf(range.pos);
    for (const line of lines) {
      commentLines.push({
        line: cursor,
        content: line.replace(/^\s*\*\s?/, "").trim(),
      });
      cursor += 1;
    }
  }

  return parseCommentLines(sourceFile.fileName, commentLines);
}

function stripLineComment(raw: string): string {
  return raw.replace(/^\/\/+\s*/, "").trim();
}

function parseCommentLines(
  filePath: string,
  commentLines: ReadonlyArray<{ line: number; content: string }>,
): DirectiveParseResult {
  const directives: ArchitectureDirective[] = [];
  const errors: DirectiveParseError[] = [];

  let pendingRuleId: ArchitectureDiagnosticRuleId | null = null;
  let pendingRuleLine = 0;

  for (const { line, content } of commentLines) {
    const ruleMatch = content.match(
      new RegExp(`${escapeForRegExp(DIRECTIVE_MARKER)}\\s*:\\s*([\\w-]+)\\s*$`),
    );
    if (ruleMatch) {
      if (pendingRuleId !== null) {
        errors.push(missingReasonError(filePath, pendingRuleLine, pendingRuleId));
      }
      const candidate = ruleMatch[1] ?? "";
      if (!RULE_ID_SET.has(candidate)) {
        errors.push({
          file: filePath,
          line,
          ruleId: null,
          message: `Unknown architecture rule id '${candidate}' in directive. Expected one of: ${ARCHITECTURE_DIAGNOSTIC_RULE_IDS.join(", ")}.`,
        });
        pendingRuleId = null;
      } else {
        pendingRuleId = candidate as ArchitectureDiagnosticRuleId;
        pendingRuleLine = line;
      }
      continue;
    }

    if (pendingRuleId !== null) {
      const reasonMatch = content.match(/^reason\s*:\s*(.+?)\s*$/i);
      if (reasonMatch) {
        const reason = (reasonMatch[1] ?? "").trim();
        if (reason.length === 0) {
          errors.push({
            file: filePath,
            line,
            ruleId: pendingRuleId,
            message: `Empty 'reason:' for directive '${DIRECTIVE_MARKER}: ${pendingRuleId}'. Provide a written reason.`,
          });
        } else {
          directives.push({ ruleId: pendingRuleId, reason });
        }
        pendingRuleId = null;
      }
    }
  }

  if (pendingRuleId !== null) {
    errors.push(missingReasonError(filePath, pendingRuleLine, pendingRuleId));
  }

  return { directives, errors };
}

function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildDirectiveIndex(
  fileDirectives: ReadonlyArray<FileDirectives>,
): ReadonlyMap<string, ReadonlySet<ArchitectureDiagnosticRuleId>> {
  const index = new Map<string, Set<ArchitectureDiagnosticRuleId>>();
  for (const { file, directives } of fileDirectives) {
    let set = index.get(file);
    if (!set) {
      set = new Set();
      index.set(file, set);
    }
    for (const d of directives) {
      set.add(d.ruleId);
    }
  }
  return index;
}

export function isDirectiveSuppressed(
  index: ReadonlyMap<string, ReadonlySet<ArchitectureDiagnosticRuleId>>,
  file: string,
  ruleId: ArchitectureDiagnosticRuleId,
): boolean {
  return index.get(file)?.has(ruleId) ?? false;
}
