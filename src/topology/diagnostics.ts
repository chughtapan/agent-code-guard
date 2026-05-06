import type { TopologyDiagnostic } from "./types.js";

export function uniqueDiagnostics(
  diagnostics: readonly TopologyDiagnostic[],
): readonly TopologyDiagnostic[] {
  const seen = new Set<string>();
  const unique: TopologyDiagnostic[] = [];

  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.ruleId}\0${diagnostic.file}\0${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(diagnostic);
  }

  return unique;
}
