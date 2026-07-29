import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Linter } from "eslint";
import { expect, it } from "vitest";
import { requireTypeScriptQualityGate as rule } from "./require-typescript-quality-gate.js";

const REQUIRED_OPTIONS = {
  allowUnreachableCode: false,
  allowUnusedLabels: false,
  forceConsistentCasingInFileNames: true,
  isolatedModules: true,
  noEmitOnError: true,
  noFallthroughCasesInSwitch: true,
  noImplicitOverride: true,
  noImplicitReturns: true,
  strict: true,
} as const;

interface Fixture {
  readonly packageJsonPath: string;
  readonly tsconfigPath: string;
}

function qualityGateFixture(extended: boolean): Fixture {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agent-code-guard-ts-cache-"));
  const packageJsonPath = path.join(directory, "package.json");
  const tsconfigPath = path.join(directory, "tsconfig.json");
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({ scripts: { lint: "tsc --noEmit" } }),
  );
  if (!extended) {
    fs.writeFileSync(tsconfigPath, JSON.stringify({ compilerOptions: REQUIRED_OPTIONS }));
    return { packageJsonPath, tsconfigPath };
  }
  fs.writeFileSync(
    path.join(directory, "tsconfig.base.json"),
    JSON.stringify({ compilerOptions: REQUIRED_OPTIONS }),
  );
  fs.writeFileSync(tsconfigPath, JSON.stringify({ extends: "./tsconfig.base.json" }));
  return { packageJsonPath, tsconfigPath };
}

function lintQualityGate(options: Fixture): readonly Linter.LintMessage[] {
  const linter = new Linter();
  return linter.verify("export const value = 1;", [
    {
      plugins: {
        test: {
          rules: { gate: rule },
        },
      },
      rules: {
        "test/gate": ["error", options],
      },
    },
  ]);
}

it("invalidates cached package scripts when package.json changes", () => {
  const fixture = qualityGateFixture(false);
  expect(lintQualityGate(fixture)).toEqual([]);
  fs.writeFileSync(
    fixture.packageJsonPath,
    JSON.stringify({ scripts: { lint: "eslint ." } }),
  );
  expect(lintQualityGate(fixture)).toEqual([
    expect.objectContaining({ messageId: "missingTypecheck" }),
  ]);
});

it("invalidates cached compiler options when an extended config changes", () => {
  const fixture = qualityGateFixture(true);
  expect(lintQualityGate(fixture)).toEqual([]);
  const baseConfigPath = path.join(path.dirname(fixture.tsconfigPath), "tsconfig.base.json");
  fs.writeFileSync(
    baseConfigPath,
    JSON.stringify({
      compilerOptions: { ...REQUIRED_OPTIONS, strictNullChecks: false },
    }),
  );
  expect(lintQualityGate(fixture)).toEqual([
    expect.objectContaining({ messageId: "missingCompilerOptions" }),
  ]);
});
