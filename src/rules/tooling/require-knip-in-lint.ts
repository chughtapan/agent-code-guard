import fs from "node:fs";
import path from "node:path";
import { Match } from "effect";
import { createRule } from "../utils/create-rule.js";

type Options = {
  readonly packageJsonPath?: string;
  readonly scriptNames?: readonly string[];
};

type MessageId = "invalidPackageJson" | "missingScript" | "missingKnip";

const DEFAULT_SCRIPT_NAMES = ["lint"] as const;
const KNIP_COMMAND_PATTERN = /(?:^|[\s;&|])(?:agent-code-guard-)?knip(?:$|[\s;&|])/;

interface PackageScripts {
  readonly scripts?: Record<string, unknown>;
}

type PackageJsonRead =
  | { readonly _tag: "Read"; readonly packageJson: PackageScripts }
  | { readonly _tag: "Unreadable"; readonly cause: unknown };

type PackageCheckResult =
  | { readonly _tag: "Configured"; readonly scriptNames: string }
  | {
    readonly _tag: "Missing";
    readonly messageId: MessageId;
    readonly scriptNames: string;
    readonly cause?: string;
  };

const cwdFor = (context: Readonly<{ cwd?: string }>): string =>
  typeof context.cwd === "string" && context.cwd.length > 0
    ? context.cwd
    : process.cwd();

const packagePathFor = (
  context: Readonly<{ cwd?: string }>,
  option: Options,
): string =>
  path.resolve(option.packageJsonPath ?? path.join(cwdFor(context), "package.json"));

const parsePackageJson = (filePath: string): PackageJsonRead => {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object"
      ? { _tag: "Read", packageJson: parsed as PackageScripts }
      : { _tag: "Unreadable", cause: "package.json did not contain an object" };
  } catch (cause) {
    return { _tag: "Unreadable", cause };
  }
};

const scriptRunsKnip = (script: unknown): boolean =>
  typeof script === "string" && KNIP_COMMAND_PATTERN.test(script);

const checkPackageScripts = (
  packageJson: PackageScripts,
  scriptNames: readonly string[],
): PackageCheckResult => {
  const scriptList = scriptNames.join(", ");
  const scripts = packageJson.scripts ?? {};
  const configured = scriptNames
    .map((name) => [name, scripts[name]] as const)
    .filter(([, script]) => typeof script === "string");

  if (configured.length === 0) {
    return { _tag: "Missing", messageId: "missingScript", scriptNames: scriptList };
  }

  if (configured.some(([, script]) => scriptRunsKnip(script))) {
    return { _tag: "Configured", scriptNames: scriptList };
  }

  return { _tag: "Missing", messageId: "missingKnip", scriptNames: scriptList };
};

const invalidPackageJson = (
  scriptNames: readonly string[],
  cause: unknown,
): PackageCheckResult => {
  return {
    _tag: "Missing",
    messageId: "invalidPackageJson",
    scriptNames: scriptNames.join(", "),
    cause: errorSummary(cause),
  };
};

const errorSummary = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

export default createRule<[Options], MessageId>({
  name: "require-knip-in-lint",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the default package quality script to run Knip so dead-code checks stay in the normal lint path.",
    },
    messages: {
      invalidPackageJson:
        "Could not read package.json while checking whether scripts {{scriptNames}} run Knip.",
      missingScript:
        "package.json must define one of scripts {{scriptNames}} and run Knip from that default quality gate.",
      missingKnip:
        "package.json scripts {{scriptNames}} must run `knip` or `agent-code-guard-knip` so dead-code checks are part of the default lint gate.",
    },
    schema: [
      {
        type: "object",
        properties: {
          packageJsonPath: { type: "string", minLength: 1 },
          scriptNames: {
            type: "array",
            items: { type: "string", minLength: 1 },
            minItems: 1,
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [{}],
  create(context, [rawOptions]) {
    const options = rawOptions ?? {};
    return {
      Program(node) {
        const packageJsonPath = packagePathFor(context, options);
        if (!fs.existsSync(packageJsonPath)) return;

        const scriptNames = options.scriptNames ?? DEFAULT_SCRIPT_NAMES;
        const result = Match.value(parsePackageJson(packageJsonPath)).pipe(
          Match.tag("Read", (read) => checkPackageScripts(read.packageJson, scriptNames)),
          Match.tag("Unreadable", (read) => invalidPackageJson(scriptNames, read.cause)),
          Match.exhaustive,
        );

        Match.value(result).pipe(
          Match.tag("Configured", () => undefined),
          Match.tag("Missing", (missing) => {
            context.report({
              node,
              messageId: missing.messageId,
              data: { scriptNames: missing.scriptNames, cause: missing.cause ?? "" },
            });
          }),
          Match.exhaustive,
        );
      },
    };
  },
});
