/**
 * @file Enforces a blocking TypeScript compiler pass and the compiler options
 * that make Agent Code Guard's typed lint contract reliable.
 */

import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { createRule } from "../utils/create-rule.js";
import { PRINCIPLE_URL } from "../utils/principles.js";
import {
  hasConfiguredScript,
  packageScriptsRunEslint,
  packageScriptsRunTypecheck,
} from "./typescript-quality-script.js";
import { missingCompilerOptions } from "./typescript-compiler-floor.js";

type MessageId =
  | "invalidPackageJson"
  | "invalidTsconfig"
  | "missingCompilerOptions"
  | "missingEslint"
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
  | {
      readonly _tag: "Read";
      readonly value: ts.CompilerOptions;
    }
  | { readonly _tag: "Unreadable"; readonly cause: unknown };

type GateResult =
  | { readonly _tag: "Configured" }
  | {
      readonly _tag: "Violation";
      readonly data?: Readonly<Record<string, string>>;
      readonly messageId: MessageId;
    };

interface GateCacheEntry {
  readonly inputs: ReadonlyMap<string, string | null>;
  readonly result: GateResult;
}

const DEFAULT_SCRIPT_NAMES = ["lint"] as const;
const QUALITY_GATE_RESULT_CACHE = new Map<string, GateCacheEntry>();

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTracked(
  filePath: string,
  inputs: Map<string, string | null>,
): string | undefined {
  const normalizedPath = path.resolve(filePath);
  try {
    const contents = fs.readFileSync(normalizedPath, "utf8");
    inputs.set(normalizedPath, contents);
    return contents;
  } catch (cause) {
    if (!(cause instanceof Error)) {
      throw cause;
    }
    inputs.set(normalizedPath, null);
    return undefined;
  }
}

function readJsonRecord(
  filePath: string,
  inputs: Map<string, string | null>,
): JsonRead {
  try {
    const contents = readTracked(filePath, inputs);
    const parsed: unknown = JSON.parse(contents ?? "");
    return isJsonRecord(parsed)
      ? { _tag: "Read", value: parsed }
      : { _tag: "Unreadable", cause: "JSON root is not an object" };
  } catch (cause) {
    return { _tag: "Unreadable", cause };
  }
}

function readCompilerOptions(
  filePath: string,
  inputs: Map<string, string | null>,
): CompilerOptionsRead {
  const readFile = (configPath: string): string | undefined =>
    readTracked(configPath, inputs);
  const config = ts.readConfigFile(filePath, readFile);
  if (config.error !== undefined) {
    return { _tag: "Unreadable", cause: config.error };
  }
  const host = { ...ts.sys, readFile };
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    host,
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

function scriptsResult(
  packageJson: JsonRecord,
  scriptNames: readonly string[],
  contract: Readonly<{
    compilerOptions: ts.CompilerOptions;
    packageJsonPath: string;
    tsconfigPath: string;
  }>,
): GateResult {
  const data = { scriptNames: scriptNames.join(", ") };
  const scripts = packageJson.scripts;
  if (!isJsonRecord(scripts) || !hasConfiguredScript(scripts, scriptNames)) {
    return { _tag: "Violation", data, messageId: "missingScript" };
  }
  const runsTypecheck = packageScriptsRunTypecheck(
    scripts,
    scriptNames,
    contract,
  );
  if (!runsTypecheck) {
    return { _tag: "Violation", data, messageId: "missingTypecheck" };
  }
  return packageScriptsRunEslint(scripts, scriptNames)
    ? { _tag: "Configured" }
    : { _tag: "Violation", data, messageId: "missingEslint" };
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

function resolvePackageJsonPath(options: QualityGateOptions, cwd: string): string {
  return path.resolve(options.packageJsonPath ?? path.join(cwd, "package.json"));
}

function resolveTsconfigPath(options: QualityGateOptions, cwd: string): string {
  return path.resolve(options.tsconfigPath ?? path.join(cwd, "tsconfig.json"));
}

function missingFileResult(
  filePath: string,
  messageId: "invalidPackageJson" | "invalidTsconfig",
  inputs: Map<string, string | null>,
): GateCacheEntry | null {
  if (fs.existsSync(filePath)) {
    return null;
  }
  inputs.set(filePath, null);
  return {
    inputs,
    result: { _tag: "Violation", messageId },
  };
}

function uncachedQualityGateResult(
  packageJsonPath: string,
  tsconfigPath: string,
  scriptNames: readonly string[],
): GateCacheEntry {
  const inputs = new Map<string, string | null>();
  const missingPackage = missingFileResult(packageJsonPath, "invalidPackageJson", inputs);
  if (missingPackage !== null) {
    return missingPackage;
  }
  const missingTsconfig = missingFileResult(tsconfigPath, "invalidTsconfig", inputs);
  if (missingTsconfig !== null) {
    return missingTsconfig;
  }

  const packageJson = readJsonRecord(packageJsonPath, inputs);
  if (packageJson._tag === "Unreadable") {
    return {
      inputs,
      result: { _tag: "Violation", messageId: "invalidPackageJson" },
    };
  }
  const compilerOptions = readCompilerOptions(tsconfigPath, inputs);
  if (compilerOptions._tag === "Unreadable") {
    return {
      inputs,
      result: { _tag: "Violation", messageId: "invalidTsconfig" },
    };
  }
  const compilerResult = compilerOptionsResult(compilerOptions.value);
  if (compilerResult._tag === "Violation") {
    return { inputs, result: compilerResult };
  }
  const scriptResult = scriptsResult(
    packageJson.value,
    scriptNames,
    {
      compilerOptions: compilerOptions.value,
      packageJsonPath,
      tsconfigPath,
    },
  );
  if (scriptResult._tag === "Violation") {
    return { inputs, result: scriptResult };
  }
  return { inputs, result: compilerResult };
}

function cacheEntryIsCurrent(entry: GateCacheEntry): boolean {
  for (const [filePath, contents] of entry.inputs) {
    const currentInputs = new Map<string, string | null>();
    readTracked(filePath, currentInputs);
    if (currentInputs.get(filePath) !== contents) {
      return false;
    }
  }
  return true;
}

function qualityGateResult(options: QualityGateOptions, cwd: string): GateResult {
  const packageJsonPath = resolvePackageJsonPath(options, cwd);
  const tsconfigPath = resolveTsconfigPath(options, cwd);
  const scriptNames = options.scriptNames ?? DEFAULT_SCRIPT_NAMES;
  const cacheKey = JSON.stringify([packageJsonPath, tsconfigPath, scriptNames]);
  const cached = QUALITY_GATE_RESULT_CACHE.get(cacheKey);
  if (cached !== undefined && cacheEntryIsCurrent(cached)) {
    return cached.result;
  }
  const entry = uncachedQualityGateResult(packageJsonPath, tsconfigPath, scriptNames);
  QUALITY_GATE_RESULT_CACHE.set(cacheKey, entry);
  return entry.result;
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
      missingEslint:
        "package.json scripts {{scriptNames}} must safely run `eslint` from the default quality gate.",
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
