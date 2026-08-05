/**
 * @file Builds, gates, sorts, and executes generated ESM module graphs so the
 * migration's before/after import-evaluation order can be observed under real
 * Node module semantics rather than inferred from source text.
 */

import * as tsParser from "@typescript-eslint/parser";
import { TSESLint } from "@typescript-eslint/utils";
import perfectionist from "eslint-plugin-perfectionist";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { requireStableFileShell } from "../require-stable-file-shell.js";
import { verticalOrganizationRuleEntries } from "../rule-entries.js";

const RECORDER_MODULE = [
  "/**",
  " * @file Collects the ordered evaluation and observation trace of one generated module graph.",
  " */",
  "",
  "export const evaluationLog = [];",
  "",
  "export function record(entry) {",
  "  evaluationLog.push(entry);",
  "}",
  "",
].join("\n");

const MAIN_MODULE = [
  "/**",
  " * @file Prints the ordered trace one generated module graph produced under Node.",
  " */",
  "",
  'import process from "node:process";',
  'import { consumerResult } from "./consumer.mjs";',
  'import { evaluationLog } from "./recorder.mjs";',
  "",
  'process.stdout.write([...evaluationLog, `result ${consumerResult}`].join("\\n"));',
  "",
].join("\n");

const SHARED_MODULES: Readonly<Record<string, string>> = {
  "main.mjs": MAIN_MODULE,
  "recorder.mjs": RECORDER_MODULE,
};

const LINT_OPTIONS = { filename: "consumer.ts" };

/**
 * Writes one generated module graph to a scratch directory and evaluates it in a
 * real Node process.
 *
 * @param modules Module basename to source text; must supply `consumer.mjs`.
 * @returns The ordered trace lines the graph printed, one per recorded event.
 */
export function runModuleGraph(modules: Readonly<Record<string, string>>): readonly string[] {
  const root = mkdtempSync(path.join(tmpdir(), "acg-import-evaluation-"));
  try {
    return traceOf(root, modules);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

/**
 * Applies the migration's sorting phase with the shipped Perfectionist entries.
 *
 * @param source Pre-sort module source text.
 * @returns The exact post-sort module source text.
 */
export function sortLikeMigration(source: string): string {
  const result = new TSESLint.Linter().verifyAndFix(source, sortConfig(), LINT_OPTIONS);
  if (result.messages.length > 0) {
    throw new Error(`Sorting phase left diagnostics: ${JSON.stringify(result.messages)}`);
  }
  return result.output;
}

/**
 * Runs the stable-shell guard that gates the migration's sorting phase.
 *
 * @param source Module source text to gate.
 * @returns Every guard message identifier the source produces, in report order.
 */
export function stableShellFindings(source: string): readonly string[] {
  return new TSESLint.Linter()
    .verify(source, guardConfig(), LINT_OPTIONS)
    .map((message) => message.messageId ?? "unknown");
}

/**
 * Builds an ordinary binding module whose evaluation records nothing.
 *
 * @param binding Exported binding name.
 * @param value String value the binding holds.
 * @returns Source text for a module the sorter may move freely.
 */
export function pureBindingModule(binding: string, value: string): string {
  return [
    "/**",
    " * @file Ordinary binding import whose evaluation has no observable side effect.",
    " */",
    "",
    `export const ${binding} = "${value}";`,
    "",
  ].join("\n");
}

function traceOf(root: string, modules: Readonly<Record<string, string>>): readonly string[] {
  for (const [name, source] of Object.entries({ ...SHARED_MODULES, ...modules })) {
    writeFileSync(path.join(root, name), source, "utf8");
  }
  const result = spawnSync(process.execPath, [path.join(root, "main.mjs")], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Module graph exited with ${String(result.status)}:\n${result.stderr}`);
  }
  return result.stdout.split("\n");
}

function sortConfig(): TSESLint.FlatConfig.Config {
  return {
    ...baseConfig(),
    plugins: { perfectionist },
    rules: {
      "perfectionist/sort-exports": verticalOrganizationRuleEntries["perfectionist/sort-exports"],
      "perfectionist/sort-imports": verticalOrganizationRuleEntries["perfectionist/sort-imports"],
    },
  };
}

function guardConfig(): TSESLint.FlatConfig.Config {
  return {
    ...baseConfig(),
    plugins: {
      "agent-code-guard": { rules: { "require-stable-file-shell": requireStableFileShell } },
    },
    rules: {
      "agent-code-guard/require-stable-file-shell":
        verticalOrganizationRuleEntries["agent-code-guard/require-stable-file-shell"],
    },
  };
}

function baseConfig(): TSESLint.FlatConfig.Config {
  return {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2024, sourceType: "module" },
    },
  };
}
