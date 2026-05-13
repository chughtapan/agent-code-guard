/**
 * @file Convert analyzer `ArchitectureDiagnostic` values into LSP
 * `Diagnostic` values for `publishDiagnostics`. Architecture findings
 * are file-level (not line-range-bound) — they map to the start of the
 * file with `agent-code-guard` as the source and the rule id as the
 * code. Editors group findings by `code` automatically.
 */

import { pathToFileURL } from "node:url";
import {
  type Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver";
import type { ArchitectureDiagnostic } from "../rules/architecture/project/api/index.js";

const FILE_HEAD_RANGE = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 1 },
};

/**
 * Convert one analyzer diagnostic to an LSP diagnostic.
 * @param finding Analyzer's architecture diagnostic.
 * @returns LSP diagnostic, pinned to the start of the file.
 */
export function toLspDiagnostic(finding: ArchitectureDiagnostic): Diagnostic {
  return {
    range: FILE_HEAD_RANGE,
    severity:
      finding.severity === "error"
        ? DiagnosticSeverity.Error
        : DiagnosticSeverity.Warning,
    code: finding.ruleId,
    source: "agent-code-guard",
    message: finding.message,
  };
}

function fileToUri(filePath: string): string {
  return pathToFileURL(filePath).toString();
}

/**
 * Group analyzer diagnostics by file URI. The LSP server publishes
 * one `publishDiagnostics` per URI, so we batch findings here.
 * @param findings Findings from one or more files.
 * @returns Map of URI to LSP diagnostics for that URI.
 */
export function groupByUri(
  findings: readonly ArchitectureDiagnostic[],
): ReadonlyMap<string, readonly Diagnostic[]> {
  const groups = new Map<string, Diagnostic[]>();
  for (const finding of findings) {
    const uri = fileToUri(finding.file);
    let bucket = groups.get(uri);
    if (bucket === undefined) {
      bucket = [];
      groups.set(uri, bucket);
    }
    bucket.push(toLspDiagnostic(finding));
  }
  return groups;
}
