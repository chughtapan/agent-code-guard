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

interface CommentLine {
  readonly line: number;
  readonly content: string;
}

export function parseDirectivesFromSourceFile(
  sourceFile: ts.SourceFile,
): DirectiveParseResult {
  const text = sourceFile.text;
  const lineOf = (pos: number) =>
    sourceFile.getLineAndCharacterOfPosition(pos).line + 1;

  const commentLines: CommentLine[] = [];
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ false);
  scanner.setText(text);

  while (true) {
    const kind = scanner.scan();
    if (kind === ts.SyntaxKind.EndOfFileToken) break;
    if (kind === ts.SyntaxKind.SingleLineCommentTrivia) {
      const start = scanner.getTokenStart();
      const end = scanner.getTokenEnd();
      commentLines.push({
        line: lineOf(start),
        content: text.slice(start, end).replace(/^\/\/+\s*/, "").trim(),
      });
      continue;
    }
    if (kind === ts.SyntaxKind.MultiLineCommentTrivia) {
      const start = scanner.getTokenStart();
      const end = scanner.getTokenEnd();
      const inner = text
        .slice(start, end)
        .replace(/^\/\*+/, "")
        .replace(/\*+\/$/, "");
      const innerStart = start + (text.slice(start).match(/^\/\*+/)?.[0].length ?? 0);
      let cursor = 0;
      for (const segment of inner.split(/\r?\n/)) {
        commentLines.push({
          line: lineOf(innerStart + cursor),
          content: segment.replace(/^\s*\*\s?/, "").trim(),
        });
        cursor += segment.length + 1;
      }
    }
  }

  return parseCommentLines(sourceFile.fileName, commentLines);
}

function parseCommentLines(
  filePath: string,
  commentLines: ReadonlyArray<CommentLine>,
): DirectiveParseResult {
  const directives: ArchitectureDirective[] = [];
  const errors: DirectiveParseError[] = [];

  let pendingRuleId: ArchitectureDiagnosticRuleId | null = null;
  let pendingRuleLine = 0;

  const strictMatcher = new RegExp(
    `^${escapeForRegExp(DIRECTIVE_MARKER)}\\s*:\\s*([\\w-]+)\\s*$`,
  );

  for (const { line, content } of commentLines) {
    const ruleMatch = content.match(strictMatcher);
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

    // If the line starts with the marker but didn't match the strict pattern,
    // the user attempted a directive and got the syntax wrong — surface it
    // instead of silently failing to suppress. Lines that merely mention the
    // marker mid-sentence (documentation, error messages) are not flagged.
    if (content.startsWith(DIRECTIVE_MARKER)) {
      if (pendingRuleId !== null) {
        errors.push(missingReasonError(filePath, pendingRuleLine, pendingRuleId));
        pendingRuleId = null;
      }
      errors.push({
        file: filePath,
        line,
        ruleId: null,
        message: `Malformed '${DIRECTIVE_MARKER}' directive. Expected '${DIRECTIVE_MARKER}: <rule-id>' on its own line.`,
      });
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
        continue;
      }

      // Reason must follow the rule line immediately. Anything else (a blank
      // comment, an unrelated annotation, license boilerplate) terminates the
      // pending directive with a missing-reason error so users can't have a
      // late `reason:` 50 lines down silently capture a directive header.
      errors.push(missingReasonError(filePath, pendingRuleLine, pendingRuleId));
      pendingRuleId = null;
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
