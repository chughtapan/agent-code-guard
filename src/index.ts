import { createRequire } from "node:module";
import type { TSESLint } from "@typescript-eslint/utils";
import asyncKeyword from "./rules/async-keyword.js";
import asUnknownAs from "./rules/as-unknown-as.js";
import bareCatch from "./rules/bare-catch.js";
import effectErrorErasure from "./rules/effect-error-erasure.js";
import effectPromise from "./rules/effect-promise.js";
import eitherDiscriminant from "./rules/either-discriminant.js";
import manualTaggedError from "./rules/manual-tagged-error.js";
import manualBrand from "./rules/manual-brand.js";
import manualOption from "./rules/manual-option.js";
import manualResult from "./rules/manual-result.js";
import noUnboundedConcurrency from "./rules/no-unbounded-concurrency.js";
import noCoverageThresholdGate from "./rules/no-coverage-threshold-gate.js";
import noHardcodedSecrets from "./rules/no-hardcoded-secrets.js";
import noManualEnumCast from "./rules/no-manual-enum-cast.js";
import noProcessEnvAtRuntime from "./rules/no-process-env-at-runtime.js";
import noRawThrowNewError from "./rules/no-raw-throw-new-error.js";
import noTestSkipOnly from "./rules/no-test-skip-only.js";
import noVitestMocks from "./rules/no-vitest-mocks.js";
import noHardcodedAssertionLiterals from "./rules/no-hardcoded-assertion-literals.js";
import noRawSql from "./rules/no-raw-sql.js";
import promiseType from "./rules/promise-type.js";
import recordCast from "./rules/record-cast.js";
import tagDiscriminant from "./rules/tag-discriminant.js";
import thenChain from "./rules/then-chain.js";
import topologyBoundaries from "./rules/topology-boundaries.js";
import { createTopologyDiagnosticRule } from "./rules/topology-diagnostic-rule.js";

const noInventoryBarrel = createTopologyDiagnosticRule(
  "no-inventory-barrel",
  ["no-inventory-barrel"],
  "Flag index files that export most sibling modules instead of a curated abstraction.",
);
const noInternalSubpathExport = createTopologyDiagnosticRule(
  "no-internal-subpath-export",
  ["no-internal-subpath-export"],
  "Flag package exports that expose internal, source, utility, helper, or wildcard paths.",
);
const noPublicVendorTypeLeak = createTopologyDiagnosticRule(
  "no-public-vendor-type-leak",
  ["no-public-vendor-type-leak"],
  "Flag public API types that mention dependency-owned vendor types.",
);
const noExportStarBoundary = createTopologyDiagnosticRule(
  "no-export-star-boundary",
  ["no-export-star-boundary"],
  "Flag public or index boundaries that use export-star declarations.",
);
const noFolderCycle = createTopologyDiagnosticRule(
  "no-folder-cycle",
  ["no-folder-cycle"],
  "Flag strongly connected folder dependency components.",
);
const noRootInternalCycle = createTopologyDiagnosticRule(
  "no-root-internal-cycle",
  ["no-root-internal-cycle"],
  "Flag root/public files and internal files that depend on each other.",
);
const noLargePublicSurface = createTopologyDiagnosticRule(
  "no-large-public-surface",
  ["no-large-public-surface"],
  "Flag public entry files with too many exported symbols or local reexports.",
);
const noCrossDomainSiblingImport = createTopologyDiagnosticRule(
  "no-cross-domain-sibling-import",
  ["no-cross-domain-sibling-import"],
  "Flag direct imports between sibling feature folders.",
);
const noUpwardLayerImport = createTopologyDiagnosticRule(
  "no-upward-layer-import",
  ["no-upward-layer-import"],
  "Flag lower-level files importing parent or root facades.",
);
const noPublicTestHelperLeak = createTopologyDiagnosticRule(
  "no-public-test-helper-leak",
  ["no-public-test-helper-leak"],
  "Flag test helper surfaces exposed as public package API.",
);
const noImplementationFilePublicEntry = createTopologyDiagnosticRule(
  "no-implementation-file-public-entry",
  ["no-implementation-file-public-entry"],
  "Flag public package subpaths named after concrete implementation files.",
);
const noPublicInfraTypeLeak = createTopologyDiagnosticRule(
  "no-public-infra-type-leak",
  ["no-public-infra-type-leak"],
  "Flag public API types that expose infrastructure libraries.",
);
const noPackageMesh = createTopologyDiagnosticRule(
  "no-package-mesh",
  ["no-package-mesh"],
  "Flag dense cyclic package folder graphs.",
);
const requireCuratedPublicFacade = createTopologyDiagnosticRule(
  "require-curated-public-facade",
  ["require-curated-public-facade"],
  "Require public facades to curate semantic contracts instead of filesystem inventory.",
);
const requireBoundaryOwnedTypes = createTopologyDiagnosticRule(
  "require-boundary-owned-types",
  ["require-boundary-owned-types"],
  "Require public boundary types to use package-owned names instead of imported vendor names.",
);

const rules = {
  "async-keyword": asyncKeyword,
  "as-unknown-as": asUnknownAs,
  "promise-type": promiseType,
  "then-chain": thenChain,
  "bare-catch": bareCatch,
  "effect-promise": effectPromise,
  "effect-error-erasure": effectErrorErasure,
  "either-discriminant": eitherDiscriminant,
  "manual-result": manualResult,
  "manual-option": manualOption,
  "manual-brand": manualBrand,
  "manual-tagged-error": manualTaggedError,
  "no-unbounded-concurrency": noUnboundedConcurrency,
  "no-process-env-at-runtime": noProcessEnvAtRuntime,
  "record-cast": recordCast,
  "no-raw-sql": noRawSql,
  "no-manual-enum-cast": noManualEnumCast,
  "no-vitest-mocks": noVitestMocks,
  "no-hardcoded-secrets": noHardcodedSecrets,
  "no-raw-throw-new-error": noRawThrowNewError,
  "no-test-skip-only": noTestSkipOnly,
  "no-coverage-threshold-gate": noCoverageThresholdGate,
  "no-hardcoded-assertion-literals": noHardcodedAssertionLiterals,
  "tag-discriminant": tagDiscriminant,
  "topology-boundaries": topologyBoundaries,
  "no-inventory-barrel": noInventoryBarrel,
  "no-internal-subpath-export": noInternalSubpathExport,
  "no-public-vendor-type-leak": noPublicVendorTypeLeak,
  "no-export-star-boundary": noExportStarBoundary,
  "no-folder-cycle": noFolderCycle,
  "no-root-internal-cycle": noRootInternalCycle,
  "no-large-public-surface": noLargePublicSurface,
  "no-cross-domain-sibling-import": noCrossDomainSiblingImport,
  "no-upward-layer-import": noUpwardLayerImport,
  "no-public-test-helper-leak": noPublicTestHelperLeak,
  "no-implementation-file-public-entry": noImplementationFilePublicEntry,
  "no-public-infra-type-leak": noPublicInfraTypeLeak,
  "no-package-mesh": noPackageMesh,
  "require-curated-public-facade": requireCuratedPublicFacade,
  "require-boundary-owned-types": requireBoundaryOwnedTypes,
} as const;

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { name: string; version: string };

const meta = {
  name: pkg.name,
  version: pkg.version,
};

interface PluginConfig {
  plugins: { "agent-code-guard": Plugin };
  rules: Record<string, TSESLint.Linter.RuleEntry>;
}

interface Plugin {
  meta: typeof meta;
  rules: typeof rules;
  configs: {
    recommended: PluginConfig;
    integrationTests: PluginConfig;
    topology: PluginConfig;
  };
}

const plugin: Plugin = {
  meta,
  rules,
  configs: {
    recommended: {
      plugins: { "agent-code-guard": null! },
      rules: {
        "agent-code-guard/async-keyword": "error",
        "agent-code-guard/as-unknown-as": "error",
        "agent-code-guard/promise-type": "error",
        "agent-code-guard/then-chain": "error",
        "agent-code-guard/bare-catch": "error",
        "agent-code-guard/effect-promise": "error",
        "agent-code-guard/effect-error-erasure": "error",
        "agent-code-guard/either-discriminant": "error",
        "agent-code-guard/manual-result": "error",
        "agent-code-guard/manual-option": "error",
        "agent-code-guard/manual-brand": "warn",
        "agent-code-guard/manual-tagged-error": "error",
        "agent-code-guard/no-unbounded-concurrency": "error",
        "agent-code-guard/no-process-env-at-runtime": "error",
        "agent-code-guard/record-cast": "error",
        "agent-code-guard/no-raw-sql": "error",
        "agent-code-guard/no-manual-enum-cast": "error",
        "agent-code-guard/no-hardcoded-secrets": "error",
        "agent-code-guard/no-raw-throw-new-error": "error",
        "agent-code-guard/no-test-skip-only": "error",
        "agent-code-guard/no-coverage-threshold-gate": "warn",
        "agent-code-guard/no-hardcoded-assertion-literals": "warn",
        "agent-code-guard/tag-discriminant": "error",
      },
    },
    integrationTests: {
      plugins: { "agent-code-guard": null! },
      rules: {
        "agent-code-guard/no-vitest-mocks": "error",
      },
    },
    topology: {
      plugins: { "agent-code-guard": null! },
      rules: {
        "agent-code-guard/no-inventory-barrel": "warn",
        "agent-code-guard/no-internal-subpath-export": "warn",
        "agent-code-guard/no-public-vendor-type-leak": "warn",
        "agent-code-guard/no-export-star-boundary": "warn",
        "agent-code-guard/no-folder-cycle": "warn",
        "agent-code-guard/no-root-internal-cycle": "warn",
        "agent-code-guard/no-large-public-surface": "warn",
        "agent-code-guard/no-cross-domain-sibling-import": "warn",
        "agent-code-guard/no-upward-layer-import": "warn",
        "agent-code-guard/no-public-test-helper-leak": "warn",
        "agent-code-guard/no-implementation-file-public-entry": "warn",
        "agent-code-guard/no-public-infra-type-leak": "warn",
        "agent-code-guard/no-package-mesh": "warn",
        "agent-code-guard/require-curated-public-facade": "warn",
        "agent-code-guard/require-boundary-owned-types": "warn",
      },
    },
  },
};

plugin.configs.recommended.plugins["agent-code-guard"] = plugin;
plugin.configs.integrationTests.plugins["agent-code-guard"] = plugin;
plugin.configs.topology.plugins["agent-code-guard"] = plugin;

export default plugin;
