/**
 * @file Defines the effective TypeScript compiler-option floor shared by
 * config validation and command-line override validation.
 */

import type * as ts from "typescript";

const REQUIRED_COMPILER_OPTIONS = [
  ["allowUnreachableCode", false],
  ["allowUnusedLabels", false],
  ["forceConsistentCasingInFileNames", true],
  ["isolatedModules", true],
  ["noEmitOnError", true],
  ["noFallthroughCasesInSwitch", true],
  ["noImplicitOverride", true],
  ["noImplicitReturns", true],
  ["strict", true],
] as const;

const STRICT_COMPILER_OPTIONS = [
  "alwaysStrict",
  "noImplicitAny",
  "noImplicitThis",
  "strictBindCallApply",
  "strictBuiltinIteratorReturn",
  "strictFunctionTypes",
  "strictNullChecks",
  "strictPropertyInitialization",
  "useUnknownInCatchVariables",
] as const satisfies ReadonlyArray<keyof ts.CompilerOptions>;

/**
 * Lists required compiler options weakened by an effective config or CLI
 * override.
 * @param compilerOptions Effective TypeScript compiler options to inspect.
 * @returns Names of options that do not meet the shared quality floor.
 */
export function missingCompilerOptions(
  compilerOptions: ts.CompilerOptions,
): readonly string[] {
  const missing: string[] = REQUIRED_COMPILER_OPTIONS.filter(
    ([name, expected]) => compilerOptions[name] !== expected,
  ).map(([name]) => name);
  for (const name of STRICT_COMPILER_OPTIONS) {
    if (compilerOptions[name] === false) {
      missing.push(name);
    }
  }
  return missing;
}
