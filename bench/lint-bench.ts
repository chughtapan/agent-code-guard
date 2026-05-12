import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const FIXTURES_ROOT = path.join(HERE, "fixtures");
const BASELINE_PATH = path.join(HERE, "baselines/baseline.json");
const TSX_BIN = path.join(REPO_ROOT, "node_modules/.bin/tsx");

interface Target {
  readonly name: string;
  readonly cwd: string;
  readonly patterns: string;
}

interface BenchOptions {
  readonly subprocesses: number;
  readonly repeats: number;
  readonly writeBaseline: boolean;
  readonly only: string | null;
}

interface SubprocessResult {
  readonly cold_ms: number;
  readonly warm_ms: readonly number[];
  readonly diagnostics: number;
  readonly diagnosticsHash: string;
  readonly peakRssBytes: number;
}

interface TargetResult {
  readonly target: string;
  readonly cold_ms_median: number;
  readonly cold_ms_min: number;
  readonly cold_ms_max: number;
  readonly warm_ms_median: number;
  readonly warm_ms_min: number;
  readonly warm_ms_max: number;
  readonly diagnostics: number;
  readonly diagnosticsHash: string;
  readonly peakRssMB: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function fmt(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`;
}

function parseOptions(argv: readonly string[]): BenchOptions {
  let subprocesses = 3;
  let repeats = 4;
  let writeBaseline = false;
  let only: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--write-baseline":
        writeBaseline = true;
        break;
      case "--subprocesses":
        subprocesses = Number.parseInt(argv[++i], 10);
        break;
      case "--repeats":
        repeats = Number.parseInt(argv[++i], 10);
        break;
      case "--only":
        only = argv[++i];
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }
  return { subprocesses, repeats, writeBaseline, only };
}

function collectTargets(only: string | null): Target[] {
  const all: Target[] = [];
  for (const size of ["small", "medium", "large", "xlarge"] as const) {
    const dir = path.join(FIXTURES_ROOT, size);
    if (!fs.existsSync(dir)) continue;
    all.push({ name: size, cwd: dir, patterns: "src/**/*.ts" });
  }
  all.push({ name: "self", cwd: REPO_ROOT, patterns: "src/**/*.ts" });
  return only === null ? all : all.filter((t) => t.name === only);
}

function runOnce(target: Target, repeats: number): SubprocessResult {
  const lintOnePath = path.join(HERE, "lint-one.ts");
  const result = spawnSync(
    TSX_BIN,
    [
      lintOnePath,
      "--cwd",
      target.cwd,
      "--patterns",
      target.patterns,
      "--repeats",
      String(repeats),
    ],
    {
      encoding: "utf8",
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --expose-gc`.trim() },
    },
  );
  if (result.status !== 0) {
    throw new Error(`lint-one exited ${result.status} for ${target.name}`);
  }
  const lines = result.stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]) as SubprocessResult;
}

function benchTarget(target: Target, opts: BenchOptions): TargetResult {
  const colds: number[] = [];
  const warms: number[] = [];
  let diagnostics = 0;
  let diagnosticsHash = "";
  let peakRss = 0;
  for (let i = 0; i < opts.subprocesses; i++) {
    const r = runOnce(target, opts.repeats);
    colds.push(r.cold_ms);
    warms.push(...r.warm_ms);
    diagnostics = r.diagnostics;
    diagnosticsHash = r.diagnosticsHash;
    peakRss = Math.max(peakRss, r.peakRssBytes);
  }
  return {
    target: target.name,
    cold_ms_median: median(colds),
    cold_ms_min: Math.min(...colds),
    cold_ms_max: Math.max(...colds),
    warm_ms_median: median(warms),
    warm_ms_min: Math.min(...warms),
    warm_ms_max: Math.max(...warms),
    diagnostics,
    diagnosticsHash,
    peakRssMB: Math.round((peakRss / (1024 * 1024)) * 10) / 10,
  };
}

function printTable(results: readonly TargetResult[], baseline: readonly TargetResult[] | null): void {
  const baselineByTarget = new Map(baseline?.map((r) => [r.target, r]) ?? []);
  const rows: string[][] = [
    ["target", "cold (med)", "warm (med)", "diagnostics", "RSS", "vs baseline"],
  ];
  for (const r of results) {
    const b = baselineByTarget.get(r.target);
    let delta = "—";
    if (b !== undefined) {
      const coldPct = ((r.cold_ms_median - b.cold_ms_median) / b.cold_ms_median) * 100;
      const warmPct = ((r.warm_ms_median - b.warm_ms_median) / b.warm_ms_median) * 100;
      const sign = (n: number): string => (n >= 0 ? "+" : "");
      delta = `cold ${sign(coldPct)}${coldPct.toFixed(1)}% · warm ${sign(warmPct)}${warmPct.toFixed(1)}%`;
    }
    rows.push([
      r.target,
      `${fmt(r.cold_ms_median)} [${fmt(r.cold_ms_min)}–${fmt(r.cold_ms_max)}]`,
      `${fmt(r.warm_ms_median)} [${fmt(r.warm_ms_min)}–${fmt(r.warm_ms_max)}]`,
      String(r.diagnostics),
      `${r.peakRssMB} MB`,
      delta,
    ]);
  }
  const widths = rows[0].map((_, i) => Math.max(...rows.map((row) => row[i].length)));
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join("  "));
  }
}

function loadBaseline(): readonly TargetResult[] | null {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) as {
    results: TargetResult[];
  };
  return parsed.results;
}

function writeBaseline(results: readonly TargetResult[]): void {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  const payload = {
    capturedAt: new Date().toISOString(),
    node: process.version,
    results,
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`\nwrote ${path.relative(REPO_ROOT, BASELINE_PATH)}`);
}

function main(): void {
  const opts = parseOptions(process.argv.slice(2));
  const targets = collectTargets(opts.only);
  if (targets.length === 0) {
    console.error("no targets matched; run `tsx bench/generate-fixture.ts` first");
    process.exit(1);
  }

  if (!fs.existsSync(path.join(REPO_ROOT, "dist/index.js"))) {
    console.error("dist/index.js not found; run `pnpm build` first");
    process.exit(1);
  }

  console.log(`bench: ${targets.length} target(s) × ${opts.subprocesses} subprocess(es) × ${opts.repeats} lint(s)`);

  const results: TargetResult[] = [];
  for (const target of targets) {
    process.stdout.write(`  ${target.name}... `);
    const r = benchTarget(target, opts);
    results.push(r);
    console.log(`cold ${fmt(r.cold_ms_median)}, warm ${fmt(r.warm_ms_median)}, ${r.diagnostics} diagnostics`);
  }

  console.log();
  const baseline = loadBaseline();
  printTable(results, baseline);

  if (opts.writeBaseline) writeBaseline(results);
}

main();
