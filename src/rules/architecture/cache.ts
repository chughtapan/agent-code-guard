import { analyzeResolvedArchitecture } from "./analyze-project.js";
import type { ArchitectureReport, ResolvedArchitectureOptions } from "./types.js";

const reportCache = new Map<string, ArchitectureReport>();
// Resolved options carry ~14 default arrays; serializing them on every rule
// invocation is several KB of work per (file × rule). Memoize the key on the
// options reference itself; the underlying memoization in resolveOptions
// already guarantees the same input maps to the same resolved object.
const keyCache = new WeakMap<ResolvedArchitectureOptions, string>();

function cacheKeyFor(options: ResolvedArchitectureOptions): string {
  const cached = keyCache.get(options);
  if (cached !== undefined) return cached;
  const key = JSON.stringify(options);
  keyCache.set(options, key);
  return key;
}

export function cachedProjectArchitecture(
  options: ResolvedArchitectureOptions,
): ArchitectureReport {
  const cacheKey = cacheKeyFor(options);
  const cached = reportCache.get(cacheKey);
  if (cached) return cached;

  const report = analyzeResolvedArchitecture(options);
  reportCache.set(cacheKey, report);
  return report;
}

export function clearArchitectureCache(): void {
  reportCache.clear();
}
