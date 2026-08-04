/**
 * @file Documents the rules/tooling/require-knip-in-lint rule, helper, or integration surface.
 */

import fs from "node:fs";
import path from "node:path";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import {
  directBinaryIndex,
  packageScriptsRunCommand,
} from "./package-script-chain.js";

interface Options {
  readonly packageJsonPath?: string;
  readonly scriptNames?: readonly string[];
}

type MessageId = "invalidPackageJson" | "missingScript" | "missingKnip";

const DEFAULT_SCRIPT_NAMES = ["lint"] as const;
const KNIP_BINARY_NAMES: ReadonlySet<string> = new Set([
  "agent-code-guard-knip",
  "knip",
]);
const NON_CHECKING_KNIP_ARGUMENTS: ReadonlySet<string> = new Set([
  "--help",
  "--no-exit-code",
  "--version",
  "--watch",
  "-V",
  "-h",
]);

interface PackageScripts {
  readonly scripts?: Record<string, unknown>;
}

function isPackageScripts(value: unknown): value is PackageScripts {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("scripts" in value) || value.scripts === undefined) {
    return true;
  }
  return typeof value.scripts === "object" && value.scripts !== null;
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

function directCommandRunsKnip(tokens: readonly string[]): boolean {
  const binaryIndex = directBinaryIndex(tokens, KNIP_BINARY_NAMES);
  if (binaryIndex === null) {
    return false;
  }
  const commandArguments = tokens.slice(binaryIndex + 1);
  return !commandArguments.some(
    (argument) =>
      NON_CHECKING_KNIP_ARGUMENTS.has(argument) ||
      argument === "--max-issues" ||
      argument.startsWith("--max-issues="),
  );
}

const cwdFor = (context: Readonly<{ cwd?: string }>): string =>
  typeof context.cwd === "string" && context.cwd.length > 0 ? context.cwd : process.cwd();

const packagePathFor = (context: Readonly<{ cwd?: string }>, option: Options): string =>
  path.resolve(option.packageJsonPath ?? path.join(cwdFor(context), "package.json"));

const parsePackageJson = (filePath: string): PackageJsonRead => {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return isPackageScripts(parsed)
      ? { _tag: "Read", packageJson: parsed }
      : { _tag: "Unreadable", cause: "package.json did not contain an object" };
  } catch (cause) {
    return { _tag: "Unreadable", cause };
  }
};

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

  if (packageScriptsRunCommand(scripts, scriptNames, directCommandRunsKnip)) {
    return { _tag: "Configured", scriptNames: scriptList };
  }

  return { _tag: "Missing", messageId: "missingKnip", scriptNames: scriptList };
};

const invalidPackageJson = (scriptNames: readonly string[], cause: unknown): PackageCheckResult => {
  return {
    _tag: "Missing",
    messageId: "invalidPackageJson",
    scriptNames: scriptNames.join(", "),
    cause: errorSummary(cause),
  };
};

function errorSummary(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function absurd(value: never): never {
  throw new Error(`unreachable tag: ${JSON.stringify(value)}`);
}

function resolvePackageCheck(
  read: PackageJsonRead,
  scriptNames: readonly string[],
): PackageCheckResult {
  switch (read._tag) {
    case "Read":
      return checkPackageScripts(read.packageJson, scriptNames);
    case "Unreadable":
      return invalidPackageJson(scriptNames, read.cause);
    default:
      return absurd(read);
  }
}

/**
 * Enforces the `require-knip-in-lint` Agent Code Guard rule.
 */
export const requireKnipInLint = createRule<
  [
    {
      readonly packageJsonPath?: string;
      readonly scriptNames?: readonly string[];
    },
  ],
  MessageId
>({
  name: "require-knip-in-lint",
  meta: {
    type: "problem",
    docs: {
      description:
        "Dead-code detection (`knip`) running in lint catches drifted exports before they accumulate; the linter checks structure, not just syntax.",
      url: PRINCIPLE_URL.DISCIPLINE,
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
        if (!fs.existsSync(packageJsonPath)) {
          return;
        }

        const scriptNames = options.scriptNames ?? DEFAULT_SCRIPT_NAMES;
        const result = resolvePackageCheck(parsePackageJson(packageJsonPath), scriptNames);

        switch (result._tag) {
          case "Configured":
            return;
          case "Missing":
            context.report({
              node,
              messageId: result.messageId,
              data: { scriptNames: result.scriptNames, cause: result.cause ?? "" },
            });
            return;
          default:
            return absurd(result);
        }
      },
    };
  },
});
