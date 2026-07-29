/**
 * @file Resolves package-script chains to a concrete TypeScript compiler
 * invocation for the TypeScript quality gate.
 */

import path from "node:path";
import * as ts from "typescript";
import { missingCompilerOptions } from "./typescript-compiler-floor.js";

const COMMAND_SEPARATOR_PATTERN = /&&/;
const PACKAGE_RUNNERS: ReadonlySet<string> = new Set(["bun", "npm", "pnpm", "yarn"]);
const TSC_RUNNERS: ReadonlySet<string> = new Set(["bunx", "npx"]);
const UNSAFE_SHELL_OPERATOR_PATTERN = /(?:\|\||[;|]|(?<!&)&(?!&)|[$`#]|\r|\n)/;
const SHELL_WORD_PATTERN = /"[^"]*"|'[^']*'|[^\s]+/gu;
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
  readonly scripts: Readonly<Record<string, string>>;
  readonly tsconfigPath: string;
}

interface ReferencedScript {
  readonly forwardedArguments: readonly string[];
  readonly name: string;
}

function stringScripts(value: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function normalizedShellWord(word: string): string | null {
  const quote = word[0];
  if ((quote === "'" || quote === '"') && word.at(-1) === quote) {
    return word.slice(1, -1);
  }
  return /['"\\]/u.test(word) ? null : word;
}

function commandTokens(command: string): readonly string[] | null {
  const words = command.trim().match(SHELL_WORD_PATTERN) ?? [];
  const tokens = words.map(normalizedShellWord);
  if (tokens.some((token) => token === null)) {
    return null;
  }
  return tokens.filter((token): token is string => token !== null);
}

function commandName(token: string): string {
  return path.basename(token);
}

function directBinaryTscIndex(names: readonly string[]): number | null {
  return names[0] === "tsc" ? 0 : null;
}

function standaloneRunnerTscIndex(names: readonly string[]): number | null {
  return TSC_RUNNERS.has(names[0] ?? "") && names[1] === "tsc" ? 1 : null;
}

function packageExecTscIndex(names: readonly string[]): number | null {
  return PACKAGE_RUNNERS.has(names[0] ?? "") &&
    names[1] === "exec" &&
    names[2] === "tsc"
    ? 2
    : null;
}

function packageBinaryTscIndex(names: readonly string[]): number | null {
  return (names[0] === "pnpm" || names[0] === "yarn") && names[1] === "tsc"
    ? 1
    : null;
}

function directTscIndex(tokens: readonly string[]): number | null {
  const names = tokens.map(commandName);
  return (
    directBinaryTscIndex(names) ??
    standaloneRunnerTscIndex(names) ??
    packageExecTscIndex(names) ??
    packageBinaryTscIndex(names)
  );
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
  const projectPath = path.resolve(
    trace.packageDirectory,
    parsed.options.project ?? "tsconfig.json",
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
  const tscIndex = directTscIndex(tokens);
  if (tscIndex === null) {
    return false;
  }
  const commandArguments = tokens.slice(tscIndex + 1);
  return commandArguments[0] === "--build" || commandArguments[0] === "-b"
    ? buildCommandRunsTypecheck(commandArguments, trace)
    : regularCommandRunsTypecheck(commandArguments, trace);
}

function referencedScript(tokens: readonly string[]): ReferencedScript | null {
  const runner = commandName(tokens[0] ?? "");
  if (!PACKAGE_RUNNERS.has(runner) || tokens[1] !== "run") {
    return null;
  }
  const name = tokens[2];
  if (name === undefined) {
    return null;
  }
  const argumentStart = tokens[3] === "--" ? 4 : 3;
  return { forwardedArguments: tokens.slice(argumentStart), name };
}

function commandRunsTypecheck(
  trace: ScriptTrace,
  command: string,
  ancestors: ReadonlySet<string>,
  forwardedArguments: readonly string[],
): boolean {
  const commandParts = commandTokens(command);
  if (commandParts === null) {
    return false;
  }
  const tokens = [...commandParts, ...forwardedArguments];
  if (directCommandRunsTypecheck(tokens, trace)) {
    return true;
  }
  const reference = referencedScript(tokens);
  return (
    reference !== null &&
    scriptRunsTypecheck(
      trace,
      reference.name,
      ancestors,
      reference.forwardedArguments,
    )
  );
}

function scriptRunsTypecheck(
  trace: ScriptTrace,
  scriptName: string,
  ancestors: ReadonlySet<string>,
  forwardedArguments: readonly string[] = [],
): boolean {
  if (ancestors.has(scriptName)) {
    return false;
  }
  const script = trace.scripts[scriptName];
  if (script === undefined) {
    return false;
  }
  if (UNSAFE_SHELL_OPERATOR_PATTERN.test(script)) {
    return false;
  }
  const commands = script.split(COMMAND_SEPARATOR_PATTERN);
  if (forwardedArguments.length > 0 && commands.length !== 1) {
    return false;
  }
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(scriptName);
  return commands.some((command) =>
    commandRunsTypecheck(trace, command, nextAncestors, forwardedArguments)
  );
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
    scripts: stringScripts(scripts),
    tsconfigPath: contract.tsconfigPath,
  };
  return scriptNames.some((name) => scriptRunsTypecheck(trace, name, new Set()));
}
