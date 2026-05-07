import { analyzeProjectArchitecture } from "./analyze-project.js";
import type { ArchitectureOptions, ArchitectureReport } from "./types.js";

const reportCache = new Map<string, ArchitectureReport>();

export function cachedProjectArchitecture(options: ArchitectureOptions): ArchitectureReport {
  const cacheKey = JSON.stringify(options);
  const cached = reportCache.get(cacheKey);
  if (cached) return cached;

  const report = analyzeProjectArchitecture(options);
  reportCache.set(cacheKey, report);
  return report;
}

export function clearArchitectureCache(): void {
  reportCache.clear();
}
