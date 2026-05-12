import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { ESLint } from "eslint";

interface Args {
  readonly cwd: string;
  readonly patterns: readonly string[];
  readonly repeats: number;
  readonly dumpPath: string | null;
}

function parseArgs(argv: readonly string[]): Args {
  let cwd: string | null = null;
  let patternsCsv: string | null = null;
  let repeats = 4;
  let dumpPath: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    switch (flag) {
      case "--cwd":
        cwd = value;
        i++;
        break;
      case "--patterns":
        patternsCsv = value;
        i++;
        break;
      case "--repeats":
        repeats = Number.parseInt(value, 10);
        i++;
        break;
      case "--dump":
        dumpPath = value;
        i++;
        break;
      default:
        throw new Error(`unknown flag: ${flag}`);
    }
  }

  if (cwd === null) throw new Error("--cwd is required");
  const patterns = (patternsCsv ?? "src/**/*.ts").split(",");
  return { cwd, patterns, repeats, dumpPath };
}

interface DiagnosticRow {
  readonly file: string;
  readonly ruleId: string;
  readonly severity: number;
  readonly message: string;
}

function flatten(results: readonly ESLint.LintResult[], cwd: string): DiagnosticRow[] {
  const rows: DiagnosticRow[] = [];
  for (const r of results) {
    const relFile = r.filePath.startsWith(cwd) ? r.filePath.slice(cwd.length + 1) : r.filePath;
    for (const m of r.messages) {
      rows.push({
        file: relFile,
        ruleId: m.ruleId ?? "<no-rule>",
        severity: m.severity,
        message: m.message,
      });
    }
  }
  rows.sort((a, b) =>
    a.file !== b.file
      ? a.file.localeCompare(b.file)
      : a.ruleId !== b.ruleId
        ? a.ruleId.localeCompare(b.ruleId)
        : a.message.localeCompare(b.message),
  );
  return rows;
}

function hash(rows: readonly DiagnosticRow[]): string {
  const h = crypto.createHash("sha256");
  for (const r of rows) h.update(`${r.file}\t${r.ruleId}\t${r.severity}\t${r.message}\n`);
  return h.digest("hex").slice(0, 16);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const eslint = new ESLint({ cwd: args.cwd });

  const timings: number[] = [];
  let lastRows: DiagnosticRow[] = [];
  let peakRss = 0;

  for (let i = 0; i < args.repeats; i++) {
    if (global.gc) global.gc();
    const before = process.memoryUsage().rss;
    const t0 = performance.now();
    const results = await eslint.lintFiles([...args.patterns]);
    const t1 = performance.now();
    const after = process.memoryUsage().rss;
    timings.push(t1 - t0);
    peakRss = Math.max(peakRss, before, after);
    lastRows = flatten(results, args.cwd);
  }

  if (args.dumpPath !== null) {
    const fs = await import("node:fs");
    fs.writeFileSync(args.dumpPath, JSON.stringify(lastRows, null, 2));
  }

  const output = {
    cwd: args.cwd,
    repeats: args.repeats,
    cold_ms: timings[0],
    warm_ms: timings.slice(1),
    diagnostics: lastRows.length,
    diagnosticsHash: hash(lastRows),
    peakRssBytes: peakRss,
  };

  process.stdout.write(JSON.stringify(output) + "\n");
}

main().catch((err: unknown) => {
  process.stderr.write(`lint-one failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
