/**
 * @file Safely resolves package-script chains to concrete executable commands.
 */

const COMMAND_SEPARATOR_PATTERN = /&&/;
const PACKAGE_RUNNERS: ReadonlySet<string> = new Set(["bun", "npm", "pnpm", "yarn"]);
const STANDALONE_RUNNERS: ReadonlySet<string> = new Set(["bunx", "npx"]);
const UNSAFE_SHELL_OPERATOR_PATTERN = /(?:\|\||[;|]|(?<!&)&(?!&)|[$`#]|\r|\n)/;
const SHELL_WORD_PATTERN = /"[^"]*"|'[^']*'|[^\s]+/gu;

interface ReferencedScript {
  readonly forwardedArguments: readonly string[];
  readonly name: string;
}

type DirectCommandMatcher = (tokens: readonly string[]) => boolean;

interface ScriptTrace {
  readonly directCommandMatches: DirectCommandMatcher;
  readonly scripts: Readonly<Record<string, string>>;
}

/**
 * Finds an exact executable token across supported package-runner forms.
 * @param tokens Parsed shell tokens.
 * @param binaryNames Exact executable names accepted by the caller.
 * @returns The matching executable index, or `null`.
 */
export function directBinaryIndex(
  tokens: readonly string[],
  binaryNames: ReadonlySet<string>,
): number | null {
  return directExecutableIndex(tokens, binaryNames) ??
    standaloneRunnerIndex(tokens, binaryNames) ??
    packageExecIndex(tokens, binaryNames) ??
    packageBinaryIndex(tokens, binaryNames);
}

/**
 * Tests whether configured package scripts safely reach a concrete command.
 * Only logical-AND composition is accepted; masking and background shell operators
 * reject the entire script that contains them.
 * @param scripts Raw package.json scripts.
 * @param scriptNames Entry scripts that may provide the command.
 * @param directCommandMatches Matcher for one parsed executable command.
 * @returns Whether a safe script chain reaches a matching command.
 */
export function packageScriptsRunCommand(
  scripts: Readonly<Record<string, unknown>>,
  scriptNames: readonly string[],
  directCommandMatches: DirectCommandMatcher,
): boolean {
  const trace: ScriptTrace = {
    directCommandMatches,
    scripts: stringScripts(scripts),
  };
  return scriptNames.some((name) => scriptMatches(trace, name, new Set()));
}

function stringScripts(value: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function commandMatches(
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
  if (trace.directCommandMatches(tokens)) {
    return true;
  }
  const reference = referencedScript(tokens);
  return reference !== null &&
    scriptMatches(
      trace,
      reference.name,
      ancestors,
      reference.forwardedArguments,
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

function referencedScript(tokens: readonly string[]): ReferencedScript | null {
  const runner = tokens[0] ?? "";
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

function scriptMatches(
  trace: ScriptTrace,
  scriptName: string,
  ancestors: ReadonlySet<string>,
  forwardedArguments: readonly string[] = [],
): boolean {
  if (ancestors.has(scriptName)) {
    return false;
  }
  const script = trace.scripts[scriptName];
  if (script === undefined || UNSAFE_SHELL_OPERATOR_PATTERN.test(script)) {
    return false;
  }
  const commands = script.split(COMMAND_SEPARATOR_PATTERN);
  if (forwardedArguments.length > 0 && commands.length !== 1) {
    return false;
  }
  const nextAncestors = new Set(ancestors);
  nextAncestors.add(scriptName);
  return commands.some((command) =>
    commandMatches(trace, command, nextAncestors, forwardedArguments)
  );
}

/**
 * Finds the binary token in a direct command without trusting arbitrary paths
 * whose basename happens to match.
 * @param tokens Parsed shell tokens.
 * @param binaryNames Exact binary names accepted by the caller.
 * @returns The matching binary index, or `null`.
 */
function directExecutableIndex(
  tokens: readonly string[],
  binaryNames: ReadonlySet<string>,
): number | null {
  return binaryNames.has(tokens[0] ?? "") ? 0 : null;
}

function standaloneRunnerIndex(
  tokens: readonly string[],
  binaryNames: ReadonlySet<string>,
): number | null {
  const standaloneRunner = STANDALONE_RUNNERS.has(tokens[0] ?? "");
  return standaloneRunner && binaryNames.has(tokens[1] ?? "") ? 1 : null;
}

function packageExecIndex(
  tokens: readonly string[],
  binaryNames: ReadonlySet<string>,
): number | null {
  const packageRunner = PACKAGE_RUNNERS.has(tokens[0] ?? "");
  return packageRunner && tokens[1] === "exec" && binaryNames.has(tokens[2] ?? "")
    ? 2
    : null;
}

function packageBinaryIndex(
  tokens: readonly string[],
  binaryNames: ReadonlySet<string>,
): number | null {
  const directRunner = tokens[0] === "pnpm" || tokens[0] === "yarn";
  return directRunner && binaryNames.has(tokens[1] ?? "") ? 1 : null;
}
