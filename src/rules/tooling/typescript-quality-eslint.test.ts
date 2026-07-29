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
  lint: string,
): { readonly packageJsonPath: string; readonly tsconfigPath: string } {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "agent-code-guard-ts-eslint-"));
  const packageJsonPath = path.join(directory, "package.json");
  const tsconfigPath = path.join(directory, "tsconfig.json");
  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify({ scripts: { lint } }, null, 2),
  );
  fs.writeFileSync(
    tsconfigPath,
    JSON.stringify({ compilerOptions: REQUIRED_OPTIONS }, null, 2),
  );
  return { packageJsonPath, tsconfigPath };
}

ruleTester.run("require-typescript-quality-gate ESLint proof", rule, {
  valid: [
    {
      code: "export const value = 1;",
      options: [qualityGateFixture("tsc --noEmit && eslint --cache .")],
    },
    {
      code: "export const value = 1;",
      options: [qualityGateFixture("tsc --noEmit && eslint -- ./")],
    },
  ],
  invalid: [
    {
      code: "export const value = 1;",
      options: [
        qualityGateFixture("tsc --noEmit && eslint --print-config=src/index.ts"),
      ],
      errors: [{ messageId: "missingEslint" }],
    },
    {
      code: "export const value = 1;",
      options: [
        qualityGateFixture("tsc --noEmit && eslint --no-config-lookup src/index.ts"),
      ],
      errors: [{ messageId: "missingEslint" }],
    },
    {
      code: "export const value = 1;",
      options: [qualityGateFixture("tsc --noEmit && eslint --pass-on-no-patterns")],
      errors: [{ messageId: "missingEslint" }],
    },
    {
      code: "export const value = 1;",
      options: [qualityGateFixture("tsc --noEmit && eslint")],
      errors: [{ messageId: "missingEslint" }],
    },
    {
      code: "export const value = 1;",
      options: [qualityGateFixture("tsc --noEmit && eslint /dev/null")],
      errors: [{ messageId: "missingEslint" }],
    },
    {
      code: "export const value = 1;",
      options: [qualityGateFixture("tsc --noEmit && eslint dist/index.js")],
      errors: [{ messageId: "missingEslint" }],
    },
  ],
});
