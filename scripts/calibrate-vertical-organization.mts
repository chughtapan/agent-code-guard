/**
 * @file Calibrates vertical-organization rule findings across a chosen TypeScript corpus and writes a report.
 */

import { ESLint } from "eslint";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import tseslint from "typescript-eslint";

const CUSTOM_RULE_IDS = [
  "agent-code-guard/no-vacuous-jsdoc",
  "agent-code-guard/require-stable-file-shell",
  "agent-code-guard/prefer-stepdown-function-order",
] as const;

type Arguments = Readonly<{
  corpus: string;
  exclude: readonly string[];
  globs: readonly string[];
  out: string;
  revision: string;
  root: string;
}>;

type Finding = Readonly<{
  column: number;
  line: number;
  path: string;
  ruleId: string;
}>;

type InspectionTotals = Readonly<{
  errors: number;
  files: number;
  warnings: number;
}>;

function parseCommaSeparated(value: string): readonly string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseArguments(argv: readonly string[]): Arguments {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === undefined || value === undefined || !flag.startsWith("--")) {
      throw new Error("Expected --corpus, --root, --revision, --globs, --exclude, and --out.");
    }
    values.set(flag.slice(2), value);
  }

  const corpus = values.get("corpus");
  const root = values.get("root");
  const revision = values.get("revision");
  const globs = values.get("globs");
  const exclude = values.get("exclude");
  const out = values.get("out");

  if ([corpus, root, revision, globs, exclude, out].some((value) => value === undefined)) {
    throw new Error("Expected --corpus, --root, --revision, --globs, --exclude, and --out.");
  }
  if (!path.isAbsolute(root) || !path.isAbsolute(out)) {
    throw new Error("--root and --out must be absolute paths.");
  }

  return {
    corpus,
    exclude: parseCommaSeparated(exclude),
    globs: [globs],
    out,
    revision,
    root,
  };
}

function markdownTable(rows: readonly Finding[]): string {
  if (rows.length === 0) {
    return "No custom-rule findings.";
  }
  return [
    "| Finding | Classification | Notes |",
    "|---|---|---|",
    ...rows.map(({ column, line, path: findingPath, ruleId }) =>
      `| \`${findingPath}:${line}:${column}:${ruleId}\` | unreviewed | pending |`),
  ].join("\n");
}

function verifyRevision(root: string, requestedRevision: string): void {
  const actualRevision = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const expectedRevision = execFileSync("git", ["-C", root, "rev-parse", "--verify", `${requestedRevision}^{commit}`], {
    encoding: "utf8",
  }).trim();

  if (actualRevision !== expectedRevision) {
    throw new Error(
      `--revision (${requestedRevision}) does not match the Git checkout at --root (${actualRevision}).`,
    );
  }
}

function inspectResults(results: Awaited<ReturnType<ESLint["lintFiles"]>>): InspectionTotals {
  const totals = results.reduce(
    (current, result) => ({
      errors: current.errors + result.errorCount,
      files: current.files + 1,
      warnings: current.warnings + result.warningCount,
    }),
    { errors: 0, files: 0, warnings: 0 },
  );
  const fatalMessages = results.flatMap((result) =>
    result.messages.filter((message) => message.fatal || message.ruleId === null),
  );

  if (fatalMessages.length > 0) {
    const [firstFatalMessage] = fatalMessages;
    throw new Error(
      `Calibration aborted because ESLint reported a fatal, parser, or configuration message: ${firstFatalMessage?.message ?? "unknown error"}`,
    );
  }

  return totals;
}

async function dependencyVersions(): Promise<Readonly<Record<string, string>>> {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    dependencies: Record<string, string>;
  };
  return Object.fromEntries(
    ["comment-parser", "eslint-plugin-perfectionist", "eslint-plugin-import-x", "eslint-plugin-jsdoc"]
      .map((name) => [name, packageJson.dependencies[name]] as const),
  );
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  if (!(await stat(args.root)).isDirectory()) {
    throw new Error(`--root is not a directory: ${args.root}`);
  }
  verifyRevision(args.root, args.revision);
  const { plugin } = await import("../src/index.js");

  const eslint = new ESLint({
    cwd: args.root,
    ignore: false,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: [...args.globs],
        ignores: [...args.exclude],
        languageOptions: {
          ecmaVersion: 2022,
          parser: tseslint.parser,
          parserOptions: { sourceType: "module" },
        },
        plugins: { "agent-code-guard": plugin },
        rules: {
          ...Object.fromEntries(CUSTOM_RULE_IDS.map((ruleId) => [ruleId, "warn"])),
        },
      },
    ],
  });
  const results = await eslint.lintFiles([...args.globs]);
  const totals = inspectResults(results);
  const findings = results
    .flatMap((result) =>
      result.messages.flatMap((message) => {
        if (message.ruleId === null || !CUSTOM_RULE_IDS.includes(message.ruleId as (typeof CUSTOM_RULE_IDS)[number])) {
          return [];
        }
        return [{
          column: message.column,
          line: message.line,
          path: path.relative(args.root, result.filePath).split(path.sep).join("/"),
          ruleId: message.ruleId,
        }];
      }),
    )
    .sort((left, right) =>
      `${left.path}:${left.line}:${left.column}:${left.ruleId}`.localeCompare(
        `${right.path}:${right.line}:${right.column}:${right.ruleId}`,
      ),
    );
  const sample = findings.slice(0, 200);
  const versions = await dependencyVersions();
  const command = process.argv.slice(1).map((argument) => JSON.stringify(argument)).join(" ");
  const ruleCounts = CUSTOM_RULE_IDS.map((ruleId) =>
    `| \`${ruleId}\` | ${findings.filter((finding) => finding.ruleId === ruleId).length} |`,
  ).join("\n");
  const report = `# ${args.corpus} vertical-organization calibration

Status: pending review.

## Input

| Field | Value |
|---|---|
| Corpus | ${args.corpus} |
| Root | \`${args.root}\` |
| Revision | \`${args.revision}\` |
| Command | \`${command}\` |
| Globs | \`${args.globs.join(",")}\` |
| Excludes | \`${args.exclude.join(",")}\` |

## Inspection totals

| Metric | Count |
|---|---:|
| Files inspected | ${totals.files} |
| Error messages | ${totals.errors} |
| Warning messages | ${totals.warnings} |

## Dependency versions

${Object.entries(versions).map(([name, version]) => `- \`${name}\`: \`${version}\``).join("\n")}

## Per-rule findings

| Rule | Findings |
|---|---:|
${ruleCounts}

## Deterministic inspection sample

${markdownTable(sample)}

## Runtime-cycle inventory

Pending manual inventory. Record every runtime cycle and its reviewed import-evaluation order.

## Unresolved boundaries

Pending review.

## Reviewed partitions and suppressions

Pending review. Each entry must name its evaluation-order or semantic exception.

## Promotion decision

Pending named reviewer approval. Promotion requires no more than 5% false positives, no repeated false-positive category, and zero unexplained Agent Code Guard migration findings.
`;

  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, report);
}

await main();
