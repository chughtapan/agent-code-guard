import fs from "node:fs";
import path from "node:path";
import type { JSONSchema4 } from "@typescript-eslint/utils/json-schema";
import { JSONSchema } from "effect";
import { cachedProjectArchitecture } from "../architecture/cache.js";
import { ArchitectureOptionsSchema, type ArchitectureOptionsInput } from "../architecture/option-schemas.js";
import { ArchitectureOptionsError, resolveArchitectureOptions } from "../architecture/options.js";
import {
  ARCHITECTURE_DIAGNOSTIC_RULE_IDS,
  ARCHITECTURE_DIRECTIVE_PARSE_ERROR_RULE_ID,
  type ArchitectureDiagnosticRuleId,
  type ArchitectureRuleId,
} from "../architecture/rule-ids.js";
import { createRule } from "../utils/create-rule.js";

type Options = [ArchitectureOptionsInput?];
type MessageIds = "architectureViolation";
export type { ArchitectureDiagnosticRuleId };

// Generate the ESLint JSONSchema from the Effect schema once at module load.
// Single source of truth for option shape: changes flow through the schema
// definition and ESLint picks them up automatically.
const optionsJsonSchema = JSONSchema.make(ArchitectureOptionsSchema) as JSONSchema4;
const schema: readonly JSONSchema4[] = [optionsJsonSchema];

export function createArchitectureDiagnosticRule(
  name: string,
  diagnosticRuleIds: readonly ArchitectureRuleId[],
  description: string,
) {
  const allowedRuleIds = new Set<ArchitectureRuleId>(diagnosticRuleIds);

  return createRule<Options, MessageIds>({
    name,
    meta: {
      type: "problem",
      docs: { description },
      messages: {
        architectureViolation: "{{message}}",
      },
      schema,
      fixable: undefined,
      hasSuggestions: false,
    },
    defaultOptions: [{}],
    create(context, [rawOptions = {}]) {
      const cwd = context.cwd ?? process.cwd();
      const filename = path.isAbsolute(context.filename)
        ? path.resolve(context.filename)
        : path.resolve(rawOptions.projectRoot ?? cwd, context.filename);
      const projectRoot =
        rawOptions.projectRoot ?? findNearestPackageRoot(filename) ?? cwd;

      let options;
      try {
        options = resolveArchitectureOptions({ ...rawOptions, projectRoot });
      } catch (error) {
        if (error instanceof ArchitectureOptionsError) {
          // Surface schema-decode failures as a single Program-level
          // diagnostic so the user sees the config problem on every file
          // instead of a confusing crash.
          return {
            Program(node) {
              context.report({
                node,
                messageId: "architectureViolation",
                data: { message: error.message },
              });
            },
          };
        }
        throw error;
      }

      const report = cachedProjectArchitecture(options);

      return {
        Program(node) {
          for (const diagnostic of report.diagnostics) {
            if (!allowedRuleIds.has(diagnostic.ruleId)) continue;
            if (path.resolve(diagnostic.file) !== filename) continue;
            context.report({
              node,
              messageId: "architectureViolation",
              data: { message: diagnostic.message },
            });
          }
        },
      };
    },
  });
}

export {
  ARCHITECTURE_DIAGNOSTIC_RULE_IDS as architectureDiagnosticRuleIds,
  ARCHITECTURE_DIRECTIVE_PARSE_ERROR_RULE_ID,
};

function findNearestPackageRoot(fileName: string): string | null {
  for (let directory = path.dirname(fileName); ; directory = path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, "package.json"))) return directory;

    const parent = path.dirname(directory);
    if (parent === directory) return null;
  }
}
