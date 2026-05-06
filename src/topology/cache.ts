import { analyzeProjectTopology } from "./analyze-project.js";
import type { TopologyOptions, TopologyReport } from "./types.js";

const reportCache = new Map<string, TopologyReport>();

export function cachedProjectTopology(options: TopologyOptions): TopologyReport {
  const cacheKey = JSON.stringify(options);
  const cached = reportCache.get(cacheKey);
  if (cached) return cached;

  const report = analyzeProjectTopology(options);
  reportCache.set(cacheKey, report);
  return report;
}

export function clearTopologyCache(): void {
  reportCache.clear();
}
