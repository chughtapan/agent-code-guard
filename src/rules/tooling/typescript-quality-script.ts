/**
 * @file Resolves package-script chains to a concrete TypeScript compiler
 * invocation for the TypeScript quality gate.
 */

import path from "node:path";
import * as ts from "typescript";
import {
  directBinaryIndex,
  packageScriptsRunCommand,
} from "./package-script-chain.js";
import { missingCompilerOptions } from "./typescript-compiler-floor.js";

const TSC_BINARY_NAMES: ReadonlySet<string> = new Set(["tsc"]);
const ESLINT_BINARY_NAMES: ReadonlySet<string> = new Set(["eslint"]);
const NON_LINTING_ESLINT_ARGUMENTS: ReadonlySet<string> = new Set([
  "--config",
  "--env-info",
  "--help",
  "--init",
  "--ignore-pattern",
  "--inspect-config",
  "--mcp",
  "--no-config-lookup",
  "--no-error-on-unmatched-pattern",
  "--pass-on-no-patterns",
  "--print-config",
  "--rule",
  "--stdin",
  "--version",
  "-c",
  "-h",
  "-v",
]);
const NON_LINTING_ESLINT_ARGUMENT_PREFIXES = [
  "--config=",
  "--ignore-pattern=",
  "--print-config=",
  "--rule=",
] as const;
const ESLINT_ARGUMENTS_WITH_VALUE: ReadonlySet<string> = new Set([
  "--cache-location",
  "--cache-strategy",
  "--concurrency",
  "--ext",
  "--flag",
  "--format",
  "--global",
  "--max-warnings",
  "--output-file",
  "--parser",
  "--parser-options",
  "--plugin",
  "--report-unused-disable-directives-severity",
  "--resolve-plugins-relative-to",
  "--stdin-filename",
  "-f",
  "-o",
]);
const ESLINT_PROJECT_TARGETS: ReadonlySet<string> = new Set([".", "./"]);
const NON_CHECKING_OPTIONS = [
  "help",
  "init",
  "listFilesOnly",
  "noCheck",
  "showConfig",
  "version",
  "watch",
] as const satisfies ReadonlyArray<keyof ts.CompilerOptions>;

interface ScriptTrace {
  readonly compilerOptions: ts.CompilerOptions;
  readonly packageDirectory: string;
  readonly tsconfigPath: string;
}

function buildProjectPath(project: string, packageDirectory: string): string {
  const resolved = path.resolve(packageDirectory, project);
  return path.extname(resolved) === ".json"
    ? resolved
    : path.join(resolved, "tsconfig.json");
}

function buildCommandRunsTypecheck(
  commandArguments: readonly string[],
  trace: ScriptTrace,
): boolean {
  const parsed = ts.parseBuildCommand(commandArguments);
  if (
    parsed.errors.length > 0 ||
    parsed.buildOptions.clean === true ||
    parsed.buildOptions.dry === true ||
    parsed.buildOptions.watch === true
  ) {
    return false;
  }
  return parsed.projects.some(
    (project) => buildProjectPath(project, trace.packageDirectory) === trace.tsconfigPath,
  );
}

function regularCommandSkipsTypecheck(parsed: ts.ParsedCommandLine): boolean {
  if (parsed.errors.length > 0 || parsed.fileNames.length > 0) {
    return true;
  }
  return NON_CHECKING_OPTIONS.some((name) => parsed.options[name] === true);
}

function regularCommandRunsTypecheck(
  commandArguments: readonly string[],
  trace: ScriptTrace,
): boolean {
  const parsed = ts.parseCommandLine(commandArguments);
  if (regularCommandSkipsTypecheck(parsed)) {
    return false;
  }
  const projectPath = buildProjectPath(
    parsed.options.project ?? "tsconfig.json",
    trace.packageDirectory,
  );
  if (projectPath !== trace.tsconfigPath) {
    return false;
  }
  return missingCompilerOptions({
    ...trace.compilerOptions,
    ...parsed.options,
  }).length === 0;
}

function directCommandRunsTypecheck(tokens: readonly string[], trace: ScriptTrace): boolean {
  const tscIndex = directBinaryIndex(tokens, TSC_BINARY_NAMES);
  if (tscIndex === null) {
    return false;
  }
  const commandArguments = tokens.slice(tscIndex + 1);
  return commandArguments[0] === "--build" || commandArguments[0] === "-b"
    ? buildCommandRunsTypecheck(commandArguments, trace)
    : regularCommandRunsTypecheck(commandArguments, trace);
}

function directCommandRunsEslint(tokens: readonly string[]): boolean {
  const binaryIndex = directBinaryIndex(tokens, ESLINT_BINARY_NAMES);
  if (binaryIndex === null) {
    return false;
  }
  const argumentsAfterBinary = tokens.slice(binaryIndex + 1);
  return !argumentsAfterBinary.some(isNonLintingEslintArgument) &&
    eslintHasProjectTarget(argumentsAfterBinary);
}

function isNonLintingEslintArgument(argument: string): boolean {
  return NON_LINTING_ESLINT_ARGUMENTS.has(argument) ||
    NON_LINTING_ESLINT_ARGUMENT_PREFIXES.some((prefix) =>
      argument.startsWith(prefix)
    );
}

function eslintHasProjectTarget(
  argumentsAfterBinary: readonly string[],
  index = 0,
): boolean {
  const argument = argumentsAfterBinary[index];
  if (argument === undefined) {
    return false;
  }
  if (argument === "--") {
    return argumentsAfterBinary.slice(index + 1).some((target) =>
      ESLINT_PROJECT_TARGETS.has(target)
    );
  }
  if (ESLINT_PROJECT_TARGETS.has(argument)) {
    return true;
  }
  const nextIndex = ESLINT_ARGUMENTS_WITH_VALUE.has(argument)
    ? index + 2
    : index + 1;
  return eslintHasProjectTarget(argumentsAfterBinary, nextIndex);
}

/**
 * Tests whether every requested entry name exists as a package script.
 * @param scripts Raw package.json scripts.
 * @param scriptNames Entry scripts that may provide the quality gate.
 * @returns Whether at least one requested script exists.
 */
export function hasConfiguredScript(
  scripts: Readonly<Record<string, unknown>>,
  scriptNames: readonly string[],
): boolean {
  return scriptNames.some((name) => typeof scripts[name] === "string");
}

/**
 * Resolves package-script references until a real tsc invocation is found.
 * @param scripts Raw package.json scripts.
 * @param scriptNames Entry scripts that may provide the quality gate.
 * @param contract Package paths and effective compiler options to validate.
 * @returns Whether a script chain runs tsc without disabling checking against the validated config.
 */
export function packageScriptsRunTypecheck(
  scripts: Readonly<Record<string, unknown>>,
  scriptNames: readonly string[],
  contract: Readonly<{
    compilerOptions: ts.CompilerOptions;
    packageJsonPath: string;
    tsconfigPath: string;
  }>,
): boolean {
  const trace: ScriptTrace = {
    compilerOptions: contract.compilerOptions,
    packageDirectory: path.dirname(contract.packageJsonPath),
    tsconfigPath: contract.tsconfigPath,
  };
  return packageScriptsRunCommand(
    scripts,
    scriptNames,
    (tokens) => directCommandRunsTypecheck(tokens, trace),
  );
}

/**
 * Resolves package-script references until an actual ESLint invocation is found.
 * @param scripts Raw package.json scripts.
 * @param scriptNames Entry scripts that may provide the quality gate.
 * @returns Whether a safe script chain runs ESLint in checking mode.
 */
export function packageScriptsRunEslint(
  scripts: Readonly<Record<string, unknown>>,
  scriptNames: readonly string[],
): boolean {
  return packageScriptsRunCommand(scripts, scriptNames, directCommandRunsEslint);
}
