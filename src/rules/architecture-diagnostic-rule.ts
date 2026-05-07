import fs from "node:fs";
import path from "node:path";
import type { JSONSchema4 } from "@typescript-eslint/utils/json-schema";
import { cachedProjectArchitecture } from "../architecture/cache.js";
import {
  DEFAULT_ARCHITECTURE_OPTIONS,
  type ArchitectureDiagnostic,
  type ArchitectureOptions,
} from "../architecture/types.js";
import { createRule } from "../utils/create-rule.js";

type Options = [ArchitectureOptions?];
type MessageIds = "architectureViolation";
export type ArchitectureDiagnosticRuleId = ArchitectureDiagnostic["ruleId"];

const schema: readonly JSONSchema4[] = [
  {
    type: "object",
    additionalProperties: false,
    properties: {
      projectRoot: { type: "string" },
      tsconfigPath: { type: "string" },
      minExportedSiblingModules: { type: "number", minimum: 1 },
      maxExportedSiblingRatio: { type: "number", minimum: 0, maximum: 1 },
      countTypeOnlyExports: { type: "boolean" },
      allowedPublicSubpaths: { type: "array", items: { type: "string" } },
      allowedTestPublicSubpaths: { type: "array", items: { type: "string" } },
      forbiddenSubpathSegments: { type: "array", items: { type: "string" } },
      implementationPathSegments: { type: "array", items: { type: "string" } },
      maxSubpathExports: { type: "number", minimum: 0 },
      maxWildcardExports: { type: "number", minimum: 0 },
      maxPublicExports: { type: "number", minimum: 1 },
      maxPublicReexports: { type: "number", minimum: 0 },
      minPublicFacadeModules: { type: "number", minimum: 1 },
      minPackageMeshFolders: { type: "number", minimum: 2 },
      maxFolderEdgeDensity: { type: "number", minimum: 0, maximum: 1 },
      maxFolderCycles: { type: "number", minimum: 0 },
      sharedFolderNames: { type: "array", items: { type: "string" } },
      infrastructureTypePackages: { type: "array", items: { type: "string" } },
      publicTypePackages: { type: "array", items: { type: "string" } },
      packageRuntime: { type: "string", enum: ["browser", "node", "universal"] },
    },
  },
];

export function createArchitectureDiagnosticRule(
  name: string,
  diagnosticRuleIds: readonly ArchitectureDiagnosticRuleId[],
  description: string,
) {
  const allowedRuleIds = new Set<ArchitectureDiagnosticRuleId>(diagnosticRuleIds);

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
    defaultOptions: [DEFAULT_ARCHITECTURE_OPTIONS],
    create(context, [rawOptions]) {
      const cwd = context.cwd ?? process.cwd();
      const filename = path.isAbsolute(context.filename)
        ? path.resolve(context.filename)
        : path.resolve(rawOptions?.projectRoot ?? cwd, context.filename);
      const projectRoot =
        rawOptions?.projectRoot ?? findNearestPackageRoot(filename) ?? cwd;
      const options = {
        ...DEFAULT_ARCHITECTURE_OPTIONS,
        ...rawOptions,
        projectRoot,
      };
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

export const architectureDiagnosticRuleIds = [
  "no-inventory-barrel",
  "no-internal-subpath-export",
  "no-public-vendor-type-leak",
  "no-export-star-boundary",
  "no-folder-cycle",
  "no-root-internal-cycle",
  "no-large-public-surface",
  "no-cross-domain-sibling-import",
  "no-upward-layer-import",
  "no-public-test-helper-leak",
  "no-implementation-file-public-entry",
  "no-public-infra-type-leak",
  "no-package-mesh",
  "require-curated-public-facade",
  "require-boundary-owned-types",
] as const satisfies readonly ArchitectureDiagnosticRuleId[];

function findNearestPackageRoot(fileName: string): string | null {
  for (let directory = path.dirname(fileName); ; directory = path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, "package.json"))) return directory;

    const parent = path.dirname(directory);
    if (parent === directory) return null;
  }
}
