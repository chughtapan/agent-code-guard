/**
 * @file Runs repeatable ESLint benchmark subprocesses and records timing and diagnostic baselines.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const FIXTURES_ROOT = path.join(HERE, "fixtures");
const BASELINE_PATH = path.join(HERE, "baselines/baseline.json");
const TSX_BIN = path.join(REPO_ROOT, "node_modules/.bin/tsx");
// eslint-disable-next-line agent-code-guard/no-process-env-at-runtime -- Boundary read: lint-one subprocesses must inherit this process's environment, and there is no config layer between a CLI benchmark and spawnSync.
const PARENT_ENV = process.env;

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
  readonly coldMs: number;
  readonly warmMs: readonly number[];
  readonly diagnostics: number;
  readonly diagnosticsHash: string;
  readonly peakRssBytes: number;
}

interface TargetResult {
  readonly target: string;
  readonly coldMsMedian: number;
  readonly coldMsMin: number;
  readonly coldMsMax: number;
  readonly warmMsMedian: number;
  readonly warmMsMin: number;
  readonly warmMsMax: number;
  readonly diagnostics: number;
  readonly diagnosticsHash: string;
  readonly peakRssMB: number;
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
    console.log(`cold ${fmt(r.coldMsMedian)}, warm ${fmt(r.warmMsMedian)}, ${r.diagnostics} diagnostics`);
  }

  console.log();
  const baseline = loadBaseline();
  printTable(results, baseline);

  if (opts.writeBaseline) {
    writeBaseline(results);
  }
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
        subprocesses = parseCount(flag, argv[++i]);
        break;
      case "--repeats":
        repeats = parseCount(flag, argv[++i]);
        break;
      case "--only":
        only = argv[++i];
        break;
      default:
        fail(`unknown flag: ${flag}`);
    }
  }
  return { subprocesses, repeats, writeBaseline, only };
}

function parseCount(flag: string, value: string): number {
  const count = Number(value);
  if (!Number.isInteger(count)) {
    fail(`${flag} expects an integer, got: ${value}`);
  }
  return count;
}

function collectTargets(only: string | null): Target[] {
  const all: Target[] = [];
  for (const size of ["small", "medium", "large", "large-ps", "xlarge"] as const) {
    const dir = path.join(FIXTURES_ROOT, size);
    if (!fs.existsSync(dir)) {
      continue;
    }
    all.push({ name: size, cwd: dir, patterns: "src/**/*.ts" });
  }
  all.push({ name: "self", cwd: REPO_ROOT, patterns: "src/**/*.ts" });
  return only === null ? all : all.filter((t) => t.name === only);
}

function benchTarget(target: Target, opts: BenchOptions): TargetResult {
  const colds: number[] = [];
  const warms: number[] = [];
  let diagnostics = 0;
  let diagnosticsHash = "";
  let peakRss = 0;
  for (let i = 0; i < opts.subprocesses; i++) {
    const r = runOnce(target, opts.repeats);
    colds.push(r.coldMs);
    warms.push(...r.warmMs);
    diagnostics = r.diagnostics;
    diagnosticsHash = r.diagnosticsHash;
    peakRss = Math.max(peakRss, r.peakRssBytes);
  }
  return {
    target: target.name,
    coldMsMedian: median(colds),
    coldMsMin: Math.min(...colds),
    coldMsMax: Math.max(...colds),
    warmMsMedian: median(warms),
    warmMsMin: Math.min(...warms),
    warmMsMax: Math.max(...warms),
    diagnostics,
    diagnosticsHash,
    peakRssMB: Math.round((peakRss / (1024 * 1024)) * 10) / 10,
  };
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
      env: { ...PARENT_ENV, NODE_OPTIONS: `${PARENT_ENV.NODE_OPTIONS ?? ""} --expose-gc`.trim() },
    },
  );
  if (result.status !== 0) {
    fail(`lint-one exited ${result.status} for ${target.name}`);
  }
  const lines = result.stdout.trim().split("\n");
  const parsed: unknown = JSON.parse(lines[lines.length - 1]);
  if (!isRecord(parsed)) {
    fail(`lint-one emitted a non-object measurement for ${target.name}`);
  }
  return toSubprocessResult(parsed);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function printTable(results: readonly TargetResult[], baseline: readonly TargetResult[] | null): void {
  const baselineByTarget = new Map(baseline?.map((r) => [r.target, r]) ?? []);
  const rows: string[][] = [
    ["target", "cold (med)", "warm (med)", "diagnostics", "hash", "RSS", "vs baseline"],
  ];
  for (const r of results) {
    const b = baselineByTarget.get(r.target);
    let delta = "—";
    if (b !== undefined) {
      const coldPct = ((r.coldMsMedian - b.coldMsMedian) / b.coldMsMedian) * 100;
      const warmPct = ((r.warmMsMedian - b.warmMsMedian) / b.warmMsMedian) * 100;
      const sign = (n: number): string => (n >= 0 ? "+" : "");
      const hashMark = r.diagnosticsHash === b.diagnosticsHash ? "" : " ⚠ HASH DRIFT";
      delta = `cold ${sign(coldPct)}${coldPct.toFixed(1)}% · warm ${sign(warmPct)}${warmPct.toFixed(1)}%${hashMark}`;
    }
    rows.push([
      r.target,
      `${fmt(r.coldMsMedian)} [${fmt(r.coldMsMin)}–${fmt(r.coldMsMax)}]`,
      `${fmt(r.warmMsMedian)} [${fmt(r.warmMsMin)}–${fmt(r.warmMsMax)}]`,
      String(r.diagnostics),
      r.diagnosticsHash.slice(0, 8),
      `${r.peakRssMB} MB`,
      delta,
    ]);
  }
  const widths = columnWidths(rows);
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join("  "));
  }
}

function columnWidths(rows: ReadonlyArray<readonly string[]>): number[] {
  const widths: number[] = [];
  for (let i = 0; i < rows[0].length; i++) {
    widths.push(Math.max(...rows.map((row) => row[i].length)));
  }
  return widths;
}

function loadBaseline(): readonly TargetResult[] | null {
  if (!fs.existsSync(BASELINE_PATH)) {
    return null;
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const rows = isRecord(parsed) ? parsed.results : null;
  if (!Array.isArray(rows) || !rows.every(isRecord)) {
    return null;
  }
  return rows.map(toTargetResult);
}

function writeBaseline(results: readonly TargetResult[]): void {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  const payload = {
    capturedAt: new Date().toISOString(),
    node: process.version,
    results: results.map(toBaselineRow),
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`\nwrote ${path.relative(REPO_ROOT, BASELINE_PATH)}`);
}

function fmt(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Reads the measurement JSON that bench/lint-one.ts prints on stdout; those key names are the
// subprocess protocol, so they stay as written there.
function toSubprocessResult(row: Record<string, unknown>): SubprocessResult {
  return {
    coldMs: readNumber(row, "cold_ms"),
    warmMs: readNumbers(row, "warm_ms"),
    diagnostics: readNumber(row, "diagnostics"),
    diagnosticsHash: readString(row, "diagnosticsHash"),
    peakRssBytes: readNumber(row, "peakRssBytes"),
  };
}

// Reads and writes the committed bench/baselines/baseline.json; its key names outlive any single
// run, so a rename here would silently orphan every recorded baseline.
function toTargetResult(row: Record<string, unknown>): TargetResult {
  return {
    target: readString(row, "target"),
    coldMsMedian: readNumber(row, "cold_ms_median"),
    coldMsMin: readNumber(row, "cold_ms_min"),
    coldMsMax: readNumber(row, "cold_ms_max"),
    warmMsMedian: readNumber(row, "warm_ms_median"),
    warmMsMin: readNumber(row, "warm_ms_min"),
    warmMsMax: readNumber(row, "warm_ms_max"),
    diagnostics: readNumber(row, "diagnostics"),
    diagnosticsHash: readString(row, "diagnosticsHash"),
    peakRssMB: readNumber(row, "peakRssMB"),
  };
}

function toBaselineRow(result: TargetResult): Record<string, number | string> {
  return {
    target: result.target,
    cold_ms_median: result.coldMsMedian,
    cold_ms_min: result.coldMsMin,
    cold_ms_max: result.coldMsMax,
    warm_ms_median: result.warmMsMedian,
    warm_ms_min: result.warmMsMin,
    warm_ms_max: result.warmMsMax,
    diagnostics: result.diagnostics,
    diagnosticsHash: result.diagnosticsHash,
    peakRssMB: result.peakRssMB,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  return typeof value === "number" ? value : Number.NaN;
}

function readNumbers(row: Record<string, unknown>, key: string): readonly number[] {
  const value = row[key];
  return Array.isArray(value)
    ? value.filter((entry: unknown): entry is number => typeof entry === "number")
    : [];
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

main();
