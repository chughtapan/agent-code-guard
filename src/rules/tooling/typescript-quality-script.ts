/**
 * @file Resolves package-script chains to a concrete TypeScript compiler
 * invocation for the TypeScript quality gate.
 */

import path from "node:path";

const COMMAND_SEPARATOR_PATTERN = /(?:&&|\|\||[;|])/;
const NO_CHECK_FLAGS: ReadonlySet<string> = new Set(["--noCheck", "--no-check"]);
const PACKAGE_RUNNERS: ReadonlySet<string> = new Set(["bun", "npm", "pnpm", "yarn"]);
const TSC_RUNNERS: ReadonlySet<string> = new Set(["bunx", "npx"]);

interface ScriptTrace {
  readonly packageDirectory: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly tsconfigPath: string;
}

function stringScripts(value: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function commandTokens(command: string): readonly string[] {
  return command.trim().split(/\s+/).filter((token) => token.length > 0);
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

function configuredProjectPath(
  tokens: readonly string[],
  tscIndex: number,
  packageDirectory: string,
): string | null {
  for (let index = tscIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "-p" || token === "--project") {
      const value = tokens[index + 1];
      return value === undefined ? null : path.resolve(packageDirectory, value);
    }
    if (token?.startsWith("--project=")) {
      return path.resolve(packageDirectory, token.slice("--project=".length));
    }
  }
  return path.join(packageDirectory, "tsconfig.json");
}

function directCommandRunsTypecheck(tokens: readonly string[], trace: ScriptTrace): boolean {
  const tscIndex = directTscIndex(tokens);
  if (tscIndex === null || tokens.some((token) => NO_CHECK_FLAGS.has(token))) {
    return false;
  }
  return (
    configuredProjectPath(tokens, tscIndex, trace.packageDirectory) === trace.tsconfigPath
  );
}

function referencedScriptName(tokens: readonly string[]): string | null {
  const runner = commandName(tokens[0] ?? "");
  if (!PACKAGE_RUNNERS.has(runner) || tokens[1] !== "run") {
    return null;
  }
  return tokens[2] ?? null;
}

function commandRunsTypecheck(
  trace: ScriptTrace,
  command: string,
  ancestors: ReadonlySet<string>,
): boolean {
  const tokens = commandTokens(command);
  if (directCommandRunsTypecheck(tokens, trace)) {
    return true;
  }
  const referencedName = referencedScriptName(tokens);
  return (
    referencedName !== null &&
    !tokens.some((token) => NO_CHECK_FLAGS.has(token)) &&
    scriptRunsTypecheck(trace, referencedName, ancestors)
  );
}

function scriptRunsTypecheck(
  trace: ScriptTrace,
  scriptName: string,
  ancestors: ReadonlySet<string>,
): boolean {
  if (ancestors.has(scriptName)) {
    return false;
  }
  const script = trace.scripts[scriptName];
  if (script === undefined) {
    return false;
  }
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(scriptName);
  return script
    .split(COMMAND_SEPARATOR_PATTERN)
    .some((command) => commandRunsTypecheck(trace, command, nextAncestors));
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
 * @param packageJsonPath Absolute path to the owning package.json.
 * @param tsconfigPath Absolute path to the validated tsconfig.json.
 * @returns Whether a script chain runs tsc without disabling checking against the validated config.
 */
export function packageScriptsRunTypecheck(
  scripts: Readonly<Record<string, unknown>>,
  scriptNames: readonly string[],
  packageJsonPath: string,
  tsconfigPath: string,
): boolean {
  const trace: ScriptTrace = {
    packageDirectory: path.dirname(packageJsonPath),
    scripts: stringScripts(scripts),
    tsconfigPath,
  };
  return scriptNames.some((name) => scriptRunsTypecheck(trace, name, new Set()));
}
