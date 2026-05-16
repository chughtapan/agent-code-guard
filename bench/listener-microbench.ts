import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import {
  analyzeProjectArchitecture,
  type ArchitectureDiagnostic,
  type ArchitectureReport,
} from "../dist/rules/architecture/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "fixtures/large");

const ARCHITECTURE_RULE_IDS = [
  "no-inventory-barrel",
  "no-internal-subpath-export",
  "no-public-vendor-type-leak",
  "no-export-star-boundary",
  "no-folder-cycle",
  "no-root-internal-cycle",
  "no-large-public-surface",
  "no-cross-domain-sibling-import",
  "no-upward-layer-import",
  "no-public-test-helper-leak",
  "no-implementation-file-public-entry",
  "no-public-infra-type-leak",
  "no-package-mesh",
  "no-large-folder",
  "folder-readme-required",
  "no-distant-folder-import",
  "require-curated-public-facade",
  "require-boundary-owned-types",
  "folder-explicit-api-required",
  "file-implicit-boundary-module",
  "shared-kernel-cohesion",
  "no-trivial-sink-file",
  "no-fat-orchestrator",
  "architecture-directive-parse-error",
] as const;

function* projectFiles(report: ArchitectureReport): Generator<string> {
  const seen = new Set<string>();
  for (const d of report.diagnostics) {
    if (seen.has(d.file)) continue;
    seen.add(d.file);
    yield d.file;
  }
}

function oldStyleScan(
  report: ArchitectureReport,
  allowedRuleIds: ReadonlySet<string>,
  filename: string,
): number {
  let matched = 0;
  for (const diagnostic of report.diagnostics) {
    if (
      allowedRuleIds.has(diagnostic.ruleId) &&
      path.resolve(diagnostic.file) === filename
    ) {
      matched++;
    }
  }
  return matched;
}

function newStyleLookup(
  report: ArchitectureReport,
  allowedRuleIds: ReadonlySet<string>,
  filename: string,
): number {
  const fileDiagnostics = report.diagnosticsByFile.get(filename);
  if (fileDiagnostics === undefined) return 0;
  let matched = 0;
  for (const diagnostic of fileDiagnostics) {
    if (allowedRuleIds.has(diagnostic.ruleId)) matched++;
  }
  return matched;
}

async function main(): Promise<void> {
  console.log(`analyzing ${path.relative(process.cwd(), FIXTURE)}...`);
  const report = analyzeProjectArchitecture({
    projectRoot: FIXTURE,
    tsconfigPath: path.join(FIXTURE, "tsconfig.json"),
  });
  const filesWithDiagnostics = [...projectFiles(report)];
  const diagnosticCount = report.diagnostics.length;
  const totalFiles = collectAllProjectFiles(report);
  console.log(
    `report: ${diagnosticCount} diagnostics across ${filesWithDiagnostics.length} files (with findings) / ${totalFiles.length} total files visited`,
  );

  const allowedSets = ARCHITECTURE_RULE_IDS.map((id) => new Set([id]));

  console.log(`\nsimulating one ESLint lint pass (R=${ARCHITECTURE_RULE_IDS.length} rules × F=${totalFiles.length} files):`);

  let oldMatched = 0;
  let newMatched = 0;

  const oldStart = performance.now();
  for (const filename of totalFiles) {
    for (const allowed of allowedSets) {
      oldMatched += oldStyleScan(report, allowed, filename);
    }
  }
  const oldElapsed = performance.now() - oldStart;

  const newStart = performance.now();
  for (const filename of totalFiles) {
    for (const allowed of allowedSets) {
      newMatched += newStyleLookup(report, allowed, filename);
    }
  }
  const newElapsed = performance.now() - newStart;

  console.log(`  old (scan-and-filter): ${oldElapsed.toFixed(0)} ms, matched ${oldMatched}`);
  console.log(`  new (indexed lookup):  ${newElapsed.toFixed(0)} ms, matched ${newMatched}`);
  console.log(`  parity:                ${oldMatched === newMatched ? "OK" : "MISMATCH"}`);
  console.log(`  speedup:               ${(oldElapsed / newElapsed).toFixed(1)}×`);
}

function collectAllProjectFiles(report: ArchitectureReport): readonly string[] {
  // simulate full project: union of files-with-diagnostics + ~1500 files (large fixture)
  const filesWithFindings = [...new Set(report.diagnostics.map((d) => d.file))];
  // pad to large-fixture size with synthetic-file-paths that have no diagnostics
  const padCount = Math.max(0, 1500 - filesWithFindings.length);
  const padded: string[] = [...filesWithFindings];
  for (let i = 0; i < padCount; i++) {
    padded.push(`${FIXTURE}/src/synthetic/file${i.toString().padStart(5, "0")}.ts`);
  }
  return padded;
}

await main();
