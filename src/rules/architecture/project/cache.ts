import { analyzeResolvedArchitecture } from "../index.js";
import type { ArchitectureReport, ResolvedArchitectureOptions } from "./diagnostics/index.js";

// Long-lived hosts (ESLint LSP, VS Code) reuse the cache across edits;
// without a TTL, "fixed" diagnostics linger until the editor restarts.
const REPORT_CACHE_TTL_MS = 5_000;

interface CachedReport {
  readonly report: ArchitectureReport;
  readonly expiresAt: number;
}

const reportCache = new Map<string, CachedReport>();
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
  const now = Date.now();
  const cached = reportCache.get(cacheKey);
  if (cached !== undefined && cached.expiresAt > now) return cached.report;

  const report = analyzeResolvedArchitecture(options);
  reportCache.set(cacheKey, { report, expiresAt: now + REPORT_CACHE_TTL_MS });
  return report;
}

export function clearArchitectureCache(): void {
  reportCache.clear();
}
