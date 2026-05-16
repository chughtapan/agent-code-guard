/**
 * @file Architecture report cache. Layered: a per-process in-memory
 * cache with the configurable `cacheTtlMs` TTL, backed by a persistent
 * on-disk report under `node_modules/.cache/agent-code-guard/` that
 * survives across linter processes. The in-memory layer absorbs the
 * per-`(file × rule)` lookup; the disk layer skips the analyzer
 * cold-build on the second and later `eslint` invocations.
 */

import type ts from "typescript";
import { analyzeResolvedArchitecture } from "../../index.js";
import type { ArchitectureReport, ResolvedArchitectureOptions } from "../diagnostics/index.js";
import { createProgram } from "../source-files.js";
import {
  computeFileWatermark,
  hashOptions,
  hydrateReport,
  readDiskCache,
  watermarksMatch,
  writeDiskCache,
} from "./disk-cache.js";

// Long-lived hosts (ESLint LSP, VS Code) reuse the cache across edits;
// without a TTL, "fixed" diagnostics linger until the editor restarts.
// The TTL is configurable via the `cacheTtlMs` architecture option;
// CI users can pass `Infinity` to disable invalidation entirely.

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

/**
 * Get the architecture report for a project, hitting the in-memory and
 * disk caches before triggering a fresh analyzer build. Subsequent
 * `eslint` invocations on an unchanged project return in ~20 ms via
 * the disk cache hit.
 * @param options Resolved architecture options (project root +
 * thresholds + allowance lists). The disk cache invalidates whenever
 * any field of this object hashes differently from the persisted run.
 * @param programProvider Lazy `ts.Program` provider used on cache
 * miss. Defaults to building a fresh program from the project
 * tsconfig; the architecture rule path passes a provider that returns
 * `parserServices.program` when typed-parser config is available.
 * @returns The architecture report (cached or freshly built).
 */
export function cachedProjectArchitecture(
  options: ResolvedArchitectureOptions,
  programProvider: () => ts.Program | null = () => createProgram(options),
): ArchitectureReport {
  const cacheKey = cacheKeyFor(options);
  const now = Date.now();
  const cached = reportCache.get(cacheKey);
  if (cached !== undefined && cached.expiresAt > now) return cached.report;

  const fromDisk = loadFromDiskCache(options);
  if (fromDisk !== null) {
    reportCache.set(cacheKey, { report: fromDisk, expiresAt: now + options.cacheTtlMs });
    return fromDisk;
  }

  const report = analyzeResolvedArchitecture(options, programProvider);
  reportCache.set(cacheKey, { report, expiresAt: now + options.cacheTtlMs });
  persistToDiskCache(options, report);
  return report;
}

function loadFromDiskCache(options: ResolvedArchitectureOptions): ArchitectureReport | null {
  const persisted = readDiskCache(options.projectRoot);
  if (persisted === null) return null;
  if (persisted.optionsHash !== hashOptions(options)) return null;
  const currentWatermark = computeFileWatermark(options);
  if (!watermarksMatch(persisted.files, currentWatermark)) return null;
  return hydrateReport(persisted);
}

function persistToDiskCache(
  options: ResolvedArchitectureOptions,
  report: ArchitectureReport,
): void {
  try {
    const files = computeFileWatermark(options);
    writeDiskCache(options.projectRoot, report, files, hashOptions(options));
  } catch (error) {
    discardCacheWriteError(error);
  }
}

function discardCacheWriteError(_captured: unknown): void {
  // Best-effort: a write failure (read-only filesystem, missing
  // node_modules) must not break the lint. The in-memory cache still
  // covers the rest of this process.
}

/**
 * Drop every entry from the in-memory cache. Tests call this between
 * fixtures so a previous test's report cannot mask a current test's
 * expectations; does not touch the on-disk cache.
 */
export function clearArchitectureCache(): void {
  reportCache.clear();
}
