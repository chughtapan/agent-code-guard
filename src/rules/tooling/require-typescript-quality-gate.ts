/**
 * @file Enforces a blocking TypeScript compiler pass and the compiler options
 * that make Agent Code Guard's typed lint contract reliable.
 */

import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";

type MessageId =
  | "invalidPackageJson"
  | "invalidTsconfig"
  | "missingCompilerOptions"
  | "missingScript"
  | "missingTypecheck";

type JsonRecord = Record<string, unknown>;
interface QualityGateOptions {
  readonly packageJsonPath?: string;
  readonly scriptNames?: readonly string[];
  readonly tsconfigPath?: string;
}

type JsonRead =
  | { readonly _tag: "Read"; readonly value: JsonRecord }
  | { readonly _tag: "Unreadable"; readonly cause: unknown };

type CompilerOptionsRead =
  | { readonly _tag: "Read"; readonly value: ts.CompilerOptions }
  | { readonly _tag: "Unreadable"; readonly cause: unknown };

type GateResult =
  | { readonly _tag: "Configured" }
  | {
      readonly _tag: "Violation";
      readonly data?: Readonly<Record<string, string>>;
      readonly messageId: MessageId;
    };

const DEFAULT_SCRIPT_NAMES = ["lint"] as const;
const TYPECHECK_SCRIPT_PATTERN = /(?:^|[\s;&|])(?:[^\s;&|]+\s+run\s+)?typecheck(?:$|[\s;&|])/;
const TSC_PATTERN = /(?:^|[\s;&|])tsc(?:$|[\s;&|])/;
const REQUIRED_COMPILER_OPTIONS = {
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

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonRecord(filePath: string): JsonRead {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return isJsonRecord(parsed)
      ? { _tag: "Read", value: parsed }
      : { _tag: "Unreadable", cause: "JSON root is not an object" };
  } catch (cause) {
    return { _tag: "Unreadable", cause };
  }
}

function readCompilerOptions(filePath: string): CompilerOptionsRead {
  const config = ts.readConfigFile(filePath, ts.sys.readFile);
  if (config.error !== undefined) {
    return { _tag: "Unreadable", cause: config.error };
  }
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(filePath),
    undefined,
    filePath,
  );
  const configErrors = parsed.errors.filter((error) => error.code !== 18003);
  return configErrors.length === 0
    ? { _tag: "Read", value: parsed.options }
    : { _tag: "Unreadable", cause: configErrors };
}

function cwdFor(context: Readonly<{ cwd?: string }>): string {
  return typeof context.cwd === "string" && context.cwd.length > 0 ? context.cwd : process.cwd();
}

function configuredScripts(
  packageJson: JsonRecord,
  scriptNames: readonly string[],
): readonly string[] {
  const scripts = packageJson.scripts;
  if (!isJsonRecord(scripts)) {
    return [];
  }
  return scriptNames.flatMap((name) => (typeof scripts[name] === "string" ? [scripts[name]] : []));
}

function missingCompilerOptions(compilerOptions: ts.CompilerOptions): readonly string[] {
  return (Object.keys(REQUIRED_COMPILER_OPTIONS) as (keyof typeof REQUIRED_COMPILER_OPTIONS)[])
    .filter((name) => compilerOptions[name] !== REQUIRED_COMPILER_OPTIONS[name]);
}

function scriptsResult(packageJson: JsonRecord, scriptNames: readonly string[]): GateResult {
  const data = { scriptNames: scriptNames.join(", ") };
  const scripts = configuredScripts(packageJson, scriptNames);
  if (scripts.length === 0) {
    return { _tag: "Violation", data, messageId: "missingScript" };
  }
  const runsTypecheck = scripts.some(
    (script) => TYPECHECK_SCRIPT_PATTERN.test(script) || TSC_PATTERN.test(script),
  );
  return runsTypecheck
    ? { _tag: "Configured" }
    : { _tag: "Violation", data, messageId: "missingTypecheck" };
}

function compilerOptionsResult(compilerOptions: ts.CompilerOptions): GateResult {
  const missingOptions = missingCompilerOptions(compilerOptions);
  return missingOptions.length === 0
    ? { _tag: "Configured" }
    : {
        _tag: "Violation",
        data: { optionNames: missingOptions.join(", ") },
        messageId: "missingCompilerOptions",
      };
}

function configuredPackageResult(
  packageJsonPath: string,
  scriptNames: readonly string[],
): GateResult {
  const packageJson = readJsonRecord(packageJsonPath);
  return packageJson._tag === "Read"
    ? scriptsResult(packageJson.value, scriptNames)
    : { _tag: "Violation", messageId: "invalidPackageJson" };
}

function configuredTsconfigResult(tsconfigPath: string): GateResult {
  const tsconfig = readCompilerOptions(tsconfigPath);
  return tsconfig._tag === "Read"
    ? compilerOptionsResult(tsconfig.value)
    : { _tag: "Violation", messageId: "invalidTsconfig" };
}

function resolvePackageJsonPath(options: QualityGateOptions, cwd: string): string {
  return path.resolve(options.packageJsonPath ?? path.join(cwd, "package.json"));
}

function resolveTsconfigPath(options: QualityGateOptions, cwd: string): string {
  return path.resolve(options.tsconfigPath ?? path.join(cwd, "tsconfig.json"));
}

function qualityGateResult(options: QualityGateOptions, cwd: string): GateResult {
  const packageJsonPath = resolvePackageJsonPath(options, cwd);
  const tsconfigPath = resolveTsconfigPath(options, cwd);
  if (!fs.existsSync(packageJsonPath)) {
    return { _tag: "Violation", messageId: "invalidPackageJson" };
  }
  if (!fs.existsSync(tsconfigPath)) {
    return { _tag: "Violation", messageId: "invalidTsconfig" };
  }

  const scriptNames = options.scriptNames ?? DEFAULT_SCRIPT_NAMES;
  const scriptResult = configuredPackageResult(packageJsonPath, scriptNames);
  if (scriptResult._tag === "Violation") {
    return scriptResult;
  }
  return configuredTsconfigResult(tsconfigPath);
}

/**
 * Requires type checking in the default lint script and a strict shared
 * compiler-option floor.
 */
export const requireTypeScriptQualityGate = createRule<
  [
    {
      readonly packageJsonPath?: string;
      readonly scriptNames?: readonly string[];
      readonly tsconfigPath?: string;
    },
  ],
  MessageId
>({
  name: "require-typescript-quality-gate",
  meta: {
    type: "problem",
    docs: {
      description:
        "Typed lint is sound only when the default quality gate runs TypeScript with one strict compiler-option floor.",
      url: PRINCIPLE_URL.TYPES_BEAT_TESTS,
    },
    messages: {
      invalidPackageJson: "Could not read package.json while checking the TypeScript quality gate.",
      invalidTsconfig: "Could not read tsconfig.json or resolve its effective compiler options.",
      missingCompilerOptions:
        "tsconfig.json must explicitly set the required compiler options: {{optionNames}}.",
      missingScript:
        "package.json must define one of scripts {{scriptNames}} as the default quality gate.",
      missingTypecheck:
        "package.json scripts {{scriptNames}} must run `tsc` or a `typecheck` script.",
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
          tsconfigPath: { type: "string", minLength: 1 },
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
        const result = qualityGateResult(options, cwdFor(context));
        if (result._tag === "Configured") {
          return;
        }
        context.report({
          node,
          messageId: result.messageId,
          data: result.data,
        });
      },
    };
  },
});
