import { expect, it } from "vitest";
import { architectureDiagnosticRuleIds } from "./plugin-rules.js";
import * as h from "./test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

const loadParser = async () => import("./architecture-exceptions.js");
const RULE_IDS = architectureDiagnosticRuleIds;

// Preamble that may appear before a directive: license headers, imports,
// blank lines, prior comments — anything except a comment line that itself
// starts with the directive marker.
const preambleArb = fc.array(
  fc.oneof(
    fc.constant("// SPDX-License-Identifier: MIT"),
    fc.constant("// Copyright (c) 2026"),
    fc.constant('import { foo } from "bar";'),
    fc.constant('"use strict";'),
    fc.constant(""),
    fc.constant("/* block license comment */"),
    fc
      .string({ minLength: 1, maxLength: 30 })
      .filter((s) => !s.includes("@agent-code-guard"))
      .map((s) => `// ${s}`),
  ),
  { minLength: 0, maxLength: 8 },
);

function makeSourceFile(name: string, source: string): ts.SourceFile {
  return ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

it("Property: directives parse regardless of leading file content", async () => {
  const { parseDirectivesFromSourceFile } = await loadParser();
  fc.assert(
    fc.property(
      preambleArb,
      fc.constantFrom(...RULE_IDS),
      fc.string({ minLength: 1, maxLength: 60 }).filter((s) => s.trim().length > 0),
      (preamble, ruleId, reason) => {
        const source =
          preamble.join("\n") +
          (preamble.length > 0 ? "\n\n" : "") +
          `// @agent-code-guard/architecture-exception: ${ruleId}\n` +
          `// reason: ${reason.replace(/\r?\n/g, " ")}\n\n` +
          "export const value = 1;\n";
        const result = parseDirectivesFromSourceFile(makeSourceFile("test.ts", source));
        expect(result.errors).toEqual([]);
        expect(result.directives).toHaveLength(1);
        expect(result.directives[0]?.ruleId).toBe(ruleId);
      },
    ),
    { numRuns: 40 },
  );
});

it("Property: a marker-prefixed line that doesn't match the strict pattern is always flagged", async () => {
  const { parseDirectivesFromSourceFile } = await loadParser();
  fc.assert(
    fc.property(
      // Either: trailing junk after a real rule-id, OR garbage instead of a rule-id.
      fc.oneof(
        fc.tuple(
          fc.constantFrom(...RULE_IDS),
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /\S/.test(s)),
        ).map(([rule, junk]) => `${rule} ${junk}`),
        fc
          .string({ minLength: 1, maxLength: 40 })
          .filter((s) => /\S/.test(s) && !/^[\w-]+$/.test(s.trim())),
      ),
      (badPayload) => {
        const source =
          `// @agent-code-guard/architecture-exception: ${badPayload}\n` +
          `// reason: should not reach here\n\n` +
          "export const value = 1;\n";
        const result = parseDirectivesFromSourceFile(makeSourceFile("malformed.ts", source));
        expect(result.directives).toEqual([]);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => /Malformed|Unknown/.test(e.message))).toBe(true);
      },
    ),
    { numRuns: 40 },
  );
});

it("Property: unknown rule-ids are always rejected", async () => {
  const { parseDirectivesFromSourceFile } = await loadParser();
  const knownIds = new Set<string>(RULE_IDS);
  fc.assert(
    fc.property(
      fc
        .string({ minLength: 1, maxLength: 30 })
        .filter((s) => /^[a-z][a-z0-9-]*$/.test(s) && !knownIds.has(s)),
      (unknownRule) => {
        const source =
          `// @agent-code-guard/architecture-exception: ${unknownRule}\n` +
          `// reason: typo\n\n` +
          "export const value = 1;\n";
        const result = parseDirectivesFromSourceFile(makeSourceFile("typo.ts", source));
        expect(result.directives).toEqual([]);
        expect(
          result.errors.some((e) => e.message.includes("Unknown architecture rule id")),
        ).toBe(true);
      },
    ),
    { numRuns: 40 },
  );
});

it("Property: any non-matching comment between rule and reason terminates the pending directive", async () => {
  const { parseDirectivesFromSourceFile } = await loadParser();
  const interveningLineArb = fc
    .string({ minLength: 1, maxLength: 40 })
    .filter((s) => /\S/.test(s) && !/^reason\b/i.test(s.trim()) && !s.includes("@agent-code-guard"))
    .map((s) => `// ${s}`);
  fc.assert(
    fc.property(
      fc.constantFrom(...RULE_IDS),
      fc.array(interveningLineArb, { minLength: 1, maxLength: 4 }),
      (ruleId, intervening) => {
        const source =
          `// @agent-code-guard/architecture-exception: ${ruleId}\n` +
          intervening.join("\n") +
          `\n// reason: too-late\n\n` +
          "export const value = 1;\n";
        const result = parseDirectivesFromSourceFile(makeSourceFile("carry.ts", source));
        expect(result.directives).toEqual([]);
        expect(
          result.errors.some((e) => e.message.includes("missing a 'reason:' follow-up")),
        ).toBe(true);
      },
    ),
    { numRuns: 40 },
  );
});
