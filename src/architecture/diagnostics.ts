import type { ArchitectureDiagnostic } from "./types.js";

export function uniqueDiagnostics(
  diagnostics: readonly ArchitectureDiagnostic[],
): readonly ArchitectureDiagnostic[] {
  const seen = new Set<string>();
  const unique: ArchitectureDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.ruleId}\0${diagnostic.file}\0${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(diagnostic);
  }

  return unique;
}
