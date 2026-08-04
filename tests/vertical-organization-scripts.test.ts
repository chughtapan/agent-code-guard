/**
 * @file Exercises the vertical-organization maintenance scripts against isolated child-process fixtures.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/* eslint-disable @typescript-eslint/no-invalid-void-type, agent-code-guard/promise-type, max-lines-per-function, sonarjs/max-lines-per-function -- The executable integration fixtures need native Promise lifecycle helpers and an inline flat config. */
// @agent-code-guard/regression-only: each case pins a script safety boundary against a real child-process fixture.

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const applyScript = path.join(repositoryRoot, "scripts/apply-vertical-organization-fix.mts");
const calibrateScript = path.join(repositoryRoot, "scripts/calibrate-vertical-organization.mts");
const tsx = path.join(repositoryRoot, "node_modules/.bin/tsx");
const fixtureRoots = new Set<string>();

function run(command: string, args: readonly string[], cwd: string): string {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with status ${result.status ?? "null"}:\n${result.stderr}${result.stdout}`,
    );
  }
  return result.stdout;
}

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(repositoryRoot, ".vertical-organization-script-test-"));
  fixtureRoots.add(root);
  return root;
}

async function writeFileShellConfig(root: string, stableShellEnabled: boolean): Promise<void> {
  const stableShellRule = stableShellEnabled
    ? `"agent-code-guard/require-stable-file-shell": "error"`
    : `"agent-code-guard/require-stable-file-shell": "off"`;
  await writeFile(path.join(root, "eslint.config.mjs"), `
const nonPerfectionistFixableRule = {
  meta: { fixable: "code", schema: [], messages: { replace: "replace" } },
  create(context) {
    return {
      Literal(node) {
        if (node.value === "non-perfectionist violation") {
          context.report({
            node,
            messageId: "replace",
            fix(fixer) {
              return fixer.replaceText(node, '"changed by a non-Perfectionist rule"');
            },
          });
        }
      },
    };
  },
};
const perfectionistFixableRule = {
  meta: { fixable: "code", schema: [], messages: { replace: "replace" } },
  create(context) {
    return {
      Literal(node) {
        if (node.value === "perfectionist violation") {
          context.report({
            node,
            messageId: "replace",
            fix(fixer) {
              return fixer.replaceText(node, '"changed by Perfectionist"');
            },
          });
        }
      },
    };
  },
};
const stableShellRule = {
  meta: { schema: [], messages: { missing: "missing file shell" } },
  create(context) {
    return {
      Program(node) {
        context.report({ node, messageId: "missing" });
      },
    };
  },
};
export default [{
  files: ["**/*.ts"],
  plugins: {
    "agent-code-guard": { rules: { "require-stable-file-shell": stableShellRule } },
    "non-perfectionist": { rules: { fixable: nonPerfectionistFixableRule } },
    perfectionist: { rules: { fixable: perfectionistFixableRule } },
  },
  rules: {
    ${stableShellRule},
    "non-perfectionist/fixable": "error",
    "perfectionist/fixable": "error",
  },
}];
`, "utf8");
}

async function initializeRepository(root: string): Promise<string> {
  run("git", ["init", "--quiet"], root);
  run("git", ["config", "user.email", "test@example.com"], root);
  run("git", ["config", "user.name", "Test User"], root);
  await writeFile(path.join(root, "source.ts"), "export const value = 1;\n", "utf8");
  run("git", ["add", "."], root);
  run("git", ["commit", "--quiet", "-m", "first revision"], root);
  await writeFile(path.join(root, "source.ts"), "export const value = 2;\n", "utf8");
  run("git", ["add", "source.ts"], root);
  run("git", ["commit", "--quiet", "-m", "second revision"], root);
  return run("git", ["rev-parse", "HEAD"], root).trim();
}

function runCalibration(root: string, revision: string, out: string): string {
  return run(tsx, [
    calibrateScript,
    "--corpus",
    "fixture",
    "--root",
    root,
    "--revision",
    revision,
    "--globs",
    "**/*.ts",
    "--exclude",
    "node_modules/**,dist/**",
    "--out",
    out,
  ], repositoryRoot);
}

afterEach(async () => {
  await Promise.all([...fixtureRoots].map((root) => rm(root, { force: true, recursive: true })));
  fixtureRoots.clear();
});

// Each case spawns a real ESLint run over a scratch corpus, which takes seconds
// on an idle machine and longer under parallel load.
describe("vertical-organization scripts", { timeout: 60_000 }, () => {
  it("leaves a non-Perfectionist fixable violation byte-identical", async () => {
    const root = await createFixtureRoot();
    await writeFileShellConfig(root, false);
    const sourcePath = path.join(root, "source.ts");
    const original = Buffer.from("const marker = \"non-perfectionist violation\";\n");
    await writeFile(sourcePath, original);
    const perfectionistPath = path.join(root, "perfectionist.ts");
    await writeFile(perfectionistPath, "const marker = \"perfectionist violation\";\n", "utf8");
    run("git", ["init", "--quiet"], root);
    run("git", ["add", "source.ts", "perfectionist.ts"], root);

    run(tsx, [applyScript], root);

    await expect(readFile(sourcePath)).resolves.toEqual(original);
    await expect(readFile(perfectionistPath, "utf8")).resolves.toBe(
      "const marker = \"changed by Perfectionist\";\n",
    );
  });

  it("requires a clean stable file shell before running any fixer", async () => {
    const root = await createFixtureRoot();
    await writeFileShellConfig(root, true);
    const sourcePath = path.join(root, "source.ts");
    const original = Buffer.from("const marker = \"non-perfectionist violation\";\n");
    await writeFile(sourcePath, original);
    run("git", ["init", "--quiet"], root);
    run("git", ["add", "source.ts"], root);

    expect(() => run(tsx, [applyScript], root)).toThrow(
      "tsx failed",
    );
    await expect(readFile(sourcePath)).resolves.toEqual(original);
  });

  it("rejects a requested revision that is not the external corpus checkout", async () => {
    const root = await createFixtureRoot();
    await initializeRepository(root);
    const out = path.join(root, "evidence.md");

    expect(() => runCalibration(root, "HEAD~1", out)).toThrow("tsx failed");
    expect(existsSync(out)).toBe(false);
  });

  it("fails closed on parser errors without changing the external corpus", async () => {
    const root = await createFixtureRoot();
    const revision = await initializeRepository(root);
    const sourcePath = path.join(root, "source.ts");
    const invalidSource = Buffer.from("export const = ;\n");
    await writeFile(sourcePath, invalidSource);
    const out = path.join(root, "evidence.md");

    expect(() => runCalibration(root, revision, out)).toThrow("tsx failed");
    await expect(readFile(sourcePath)).resolves.toEqual(invalidSource);
    expect(existsSync(out)).toBe(false);
  }, 60_000);

  it("records deterministic inspection file and error totals", async () => {
    const root = await createFixtureRoot();
    const revision = await initializeRepository(root);
    const sourcePath = path.join(root, "source.ts");
    const original = await readFile(sourcePath);
    const out = path.join(root, "evidence.md");

    runCalibration(root, revision, out);

    await expect(readFile(sourcePath)).resolves.toEqual(original);
    await expect(readFile(out, "utf8")).resolves.toContain("| Files inspected | 1 |");
    await expect(readFile(out, "utf8")).resolves.toContain("| Error messages | 0 |");
  }, 60_000);
});

/* eslint-enable @typescript-eslint/no-invalid-void-type, agent-code-guard/promise-type, max-lines-per-function, sonarjs/max-lines-per-function -- End integration-fixture exceptions. */
