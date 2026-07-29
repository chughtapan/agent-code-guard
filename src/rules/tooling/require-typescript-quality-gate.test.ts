import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as tsParser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import { requireTypeScriptQualityGate as rule } from "./require-typescript-quality-gate.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
});

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

function qualityGateFixture(
  scripts: Readonly<Record<string, string>>,
  compilerOptions: Readonly<Record<string, unknown>> = REQUIRED_OPTIONS,
): { readonly packageJsonPath: string; readonly tsconfigPath: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agent-code-guard-ts-gate-"));
  const packageJsonPath = path.join(directory, "package.json");
  const tsconfigPath = path.join(directory, "tsconfig.json");
  fs.writeFileSync(packageJsonPath, JSON.stringify({ scripts }, null, 2));
  fs.writeFileSync(tsconfigPath, JSON.stringify({ compilerOptions }, null, 2));
  return { packageJsonPath, tsconfigPath };
}

function rawQualityGateFixture(
  packageJson: string,
  tsconfig: string,
): { readonly packageJsonPath: string; readonly tsconfigPath: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agent-code-guard-ts-gate-"));
  const packageJsonPath = path.join(directory, "package.json");
  const tsconfigPath = path.join(directory, "tsconfig.json");
  fs.writeFileSync(packageJsonPath, packageJson);
  fs.writeFileSync(tsconfigPath, tsconfig);
  return { packageJsonPath, tsconfigPath };
}

function missingQualityGateFixture(
  missing: "packageJson" | "tsconfig",
): { readonly packageJsonPath: string; readonly tsconfigPath: string } {
  const fixture = qualityGateFixture({ lint: "tsc --noEmit && eslint ." });
  fs.unlinkSync(missing === "packageJson" ? fixture.packageJsonPath : fixture.tsconfigPath);
  return fixture;
}

function inheritedQualityGateFixture(): {
  readonly packageJsonPath: string;
  readonly tsconfigPath: string;
} {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agent-code-guard-ts-gate-"));
  const packageJsonPath = path.join(directory, "package.json");
  const tsconfigPath = path.join(directory, "tsconfig.json");
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({ scripts: { lint: "tsc --noEmit && eslint ." } }, null, 2),
  );
  fs.writeFileSync(
    path.join(directory, "tsconfig.base.json"),
    JSON.stringify({ compilerOptions: REQUIRED_OPTIONS }, null, 2),
  );
  fs.writeFileSync(
    tsconfigPath,
    '{\n  // TypeScript config syntax and inherited options must be honored.\n  "extends": "./tsconfig.base.json",\n}\n',
  );
  return { packageJsonPath, tsconfigPath };
}

ruleTester.run("require-typescript-quality-gate", rule, {
  valid: [
    {
      code: "export const value = 1;",
      options: [qualityGateFixture({ lint: "tsc --noEmit && eslint ." })],
    },
    {
      code: "export const value = 1;",
      options: [
        {
          ...qualityGateFixture({
            check: "pnpm run typecheck && eslint .",
            typecheck: "tsc --noEmit",
          }),
          scriptNames: ["check"],
        },
      ],
    },
    {
      code: "export const value = 1;",
      options: [inheritedQualityGateFixture()],
    },
  ],
  invalid: [
    {
      code: "export const value = 1;",
      options: [qualityGateFixture({ lint: "eslint ." })],
      errors: [{ messageId: "missingTypecheck" }],
    },
    {
      code: "export const value = 1;",
      options: [qualityGateFixture({ lint: "tsc --noCheck && eslint ." })],
      errors: [{ messageId: "missingTypecheck" }],
    },
    {
      code: "export const value = 1;",
      options: [qualityGateFixture({ lint: "echo tsc && eslint ." })],
      errors: [{ messageId: "missingTypecheck" }],
    },
    {
      code: "export const value = 1;",
      options: [
        qualityGateFixture({
          lint: "pnpm run typecheck && eslint .",
          typecheck: "echo skipped",
        }),
      ],
      errors: [{ messageId: "missingTypecheck" }],
    },
    {
      code: "export const value = 1;",
      options: [
        qualityGateFixture({
          lint: "pnpm run typecheck && eslint .",
          typecheck: "pnpm run lint",
        }),
      ],
      errors: [{ messageId: "missingTypecheck" }],
    },
    {
      code: "export const value = 1;",
      options: [qualityGateFixture({ test: "vitest run" })],
      errors: [{ messageId: "missingScript" }],
    },
    {
      code: "export const value = 1;",
      options: [
        qualityGateFixture(
          { lint: "tsc --noEmit && eslint ." },
          { ...REQUIRED_OPTIONS, noImplicitReturns: false },
        ),
      ],
      errors: [{ messageId: "missingCompilerOptions" }],
    },
    {
      code: "export const value = 1;",
      options: [missingQualityGateFixture("packageJson")],
      errors: [{ messageId: "invalidPackageJson" }],
    },
    {
      code: "export const value = 1;",
      options: [missingQualityGateFixture("tsconfig")],
      errors: [{ messageId: "invalidTsconfig" }],
    },
    {
      code: "export const value = 1;",
      options: [rawQualityGateFixture("{not-json", JSON.stringify({ compilerOptions: {} }))],
      errors: [{ messageId: "invalidPackageJson" }],
    },
    {
      code: "export const value = 1;",
      options: [
        rawQualityGateFixture(
          JSON.stringify({ scripts: { lint: "tsc --noEmit && eslint ." } }),
          "{not-json",
        ),
      ],
      errors: [{ messageId: "invalidTsconfig" }],
    },
    {
      code: "export const value = 1;",
      options: [
        rawQualityGateFixture(
          JSON.stringify({ scripts: { lint: "tsc --noEmit && eslint ." } }),
          JSON.stringify({ compilerOptions: {} }),
        ),
      ],
      errors: [{ messageId: "missingCompilerOptions" }],
    },
  ],
});
