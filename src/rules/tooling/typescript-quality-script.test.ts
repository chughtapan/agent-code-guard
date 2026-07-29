import { expect, it } from "vitest";
import { packageScriptsRunTypecheck } from "./typescript-quality-script.js";

const compilerOptions = {
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

const contract = {
  compilerOptions,
  packageJsonPath: "/workspace/package.json",
  tsconfigPath: "/workspace/tsconfig.json",
} as const;

it.each([
  'tsc --project "./tsconfig.json"',
  "tsc --project .",
])("accepts the configured project path: %s", (lint) => {
  const scripts = { lint };
  expect(packageScriptsRunTypecheck(scripts, ["lint"], contract)).toBe(true);
});

it.each([
  "./fake/tsc --noEmit",
  "./fake/pnpm exec tsc --noEmit",
  "echo tsc",
])("rejects executable-path basename impersonation: %s", (lint) => {
  expect(packageScriptsRunTypecheck({ lint }, ["lint"], contract)).toBe(false);
});
