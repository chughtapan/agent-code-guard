import { expect, it } from "vitest";
import * as h from "../../test-support/helper-fixtures.js";
import type { ArchitectureDiagnostic } from "../../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

it("deduplicates diagnostics by rule, file, and message", () => {
  const diagnostic: ArchitectureDiagnostic = {
    ruleId: "no-inventory-barrel",
    file: "/repo/src/index.ts",
    severity: "warn",
    message: "same",
  };

  expect(uniqueDiagnostics([diagnostic, diagnostic])).toEqual([diagnostic]);
});

it("Property: diagnostic dedupe key is rule plus file plus message", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(segmentArb, { minLength: 1, maxLength: 6 }),
      (messages) => {
        const diagnostics: ArchitectureDiagnostic[] = messages.flatMap((message) => [
          {
            ruleId: "no-inventory-barrel",
            file: "/repo/src/index.ts",
            severity: "warn",
            message,
          },
          {
            ruleId: "no-inventory-barrel",
            file: "/repo/src/index.ts",
            severity: "error",
            message,
          },
        ]);

        expect(uniqueDiagnostics(diagnostics)).toHaveLength(messages.length);
      },
    ),
    { numRuns: 80 },
  );
});

it("normalizes options and clears the architecture cache without retaining stale reports", () => {
  const root = path.resolve("/repo");
  expect(resolveArchitectureOptions({ projectRoot: root, tsconfigPath: "tsconfig.eslint.json" }))
    .toMatchObject({
      projectRoot: root,
      tsconfigPath: path.resolve(root, "tsconfig.eslint.json"),
      minExportedSiblingModules: 4,
      maxExportedSiblingRatio: 0.6,
    });

  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acg-architecture-cache-"));
  try {
    writeArchitectureCacheFixtureProject(projectRoot);
    const options = resolveArchitectureOptions({
      projectRoot,
      minExportedSiblingModules: 1,
      maxExportedSiblingRatio: 0,
      // Disable TTL — this test asserts cache holds until clear() is
      // called, independent of wall-clock. Under parallel test load
      // the 5s default can expire mid-test.
      cacheTtlMs: Infinity,
    });
    const staleReport = cachedProjectArchitecture(options);
    expect(diagnosticsForRule(staleReport.diagnostics, "no-inventory-barrel")).toHaveLength(1);

    fs.writeFileSync(path.join(projectRoot, "src", "index.ts"), "export const ok = true;\n");
    expect(cachedProjectArchitecture(options)).toBe(staleReport);

    clearArchitectureCache();
    expect(
      diagnosticsForRule(cachedProjectArchitecture(options).diagnostics, "no-inventory-barrel"),
    ).toEqual([]);
  } finally {
    clearArchitectureCache();
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

function writeArchitectureCacheFixtureProject(projectRoot: string): void {
  fs.writeFileSync(
    path.join(projectRoot, "package.json"),
    JSON.stringify({
      name: "fixture",
      version: "1.0.0",
      type: "module",
      exports: { ".": "./dist/index.js" },
    }),
  );
  fs.writeFileSync(path.join(projectRoot, "tsconfig.json"), architectureCacheTsconfig());
  fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, "src", "index.ts"),
    [
      'export { M0 } from "./m0.js";',
      'export { M1 } from "./m1.js";',
      'export { M2 } from "./m2.js";',
      'export { M3 } from "./m3.js";',
    ].join("\n"),
  );

  for (let index = 0; index < 4; index += 1) {
    fs.writeFileSync(
      path.join(projectRoot, "src", `m${index}.ts`),
      `export const M${index} = ${index};\n`,
    );
  }
}

function architectureCacheTsconfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      skipLibCheck: true,
      declaration: true,
      outDir: "./dist",
      rootDir: "./src",
    },
    include: ["src/**/*"],
  });
}

it("Property: schema rejects bare-string allowance entries on every reason-bearing option", () => {
  const reasonBearingOptions = [
    "publicTypePackages",
    "infrastructureTypePackages",
    "allowedPublicSubpaths",
    "allowedTestPublicSubpaths",
    "sharedFolderNames",
  ] as const;
  fc.assert(
    fc.property(
      fc.constantFrom(...reasonBearingOptions),
      fc.array(fc.string({ minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 4 }),
      (optionName, bareStrings) => {
        expect(() =>
          resolveArchitectureOptions({ [optionName]: bareStrings }),
        ).toThrowError(new RegExp(optionName));
      },
    ),
    { numRuns: 40 },
  );
});

it("Property: schema rejects allowance entries missing a reason on every reason-bearing option", () => {
  const valueKey = {
    publicTypePackages: "package",
    infrastructureTypePackages: "package",
    allowedPublicSubpaths: "subpath",
    allowedTestPublicSubpaths: "subpath",
    sharedFolderNames: "folder",
  } as const;
  fc.assert(
    fc.property(
      fc.constantFrom(...(Object.keys(valueKey) as Array<keyof typeof valueKey>)),
      fc.string({ minLength: 1, maxLength: 12 }),
      (optionName, value) => {
        const entry = { [valueKey[optionName]]: value };
        expect(() =>
          resolveArchitectureOptions({ [optionName]: [entry] }),
        ).toThrowError(/reason/i);
      },
    ),
    { numRuns: 40 },
  );
});

it("Property: schema rejects packageRuntime values outside the allowed enum", () => {
  fc.assert(
    fc.property(
      fc
        .string({ minLength: 1, maxLength: 16 })
        .filter((s) => !["browser", "node", "universal"].includes(s)),
      (badRuntime) => {
        expect(() =>
          resolveArchitectureOptions({ packageRuntime: badRuntime }),
        ).toThrowError(/packageRuntime/);
      },
    ),
    { numRuns: 40 },
  );
});

it("Property: schema enforces ratio option bounds inclusively", () => {
  const ratioOptions = [
    "maxExportedSiblingRatio",
    "maxFolderEdgeDensity",
    "maxSharedKernelMedianOverlap",
  ] as const;

  fc.assert(
    fc.property(
      fc.constantFrom(...ratioOptions),
      fc.oneof(
        fc.double({ min: 0.000001, max: 100, noNaN: true }).map((n) => 1 + n),
        fc.double({ min: 0.000001, max: 100, noNaN: true }).map((n) => -n),
      ),
      (optionName, invalidRatio) => {
        expect(() =>
          resolveArchitectureOptions({ [optionName]: invalidRatio }),
        ).toThrowError(new RegExp(optionName));
      },
    ),
    { numRuns: 40 },
  );

  expect(resolveArchitectureOptions({ maxExportedSiblingRatio: 0 }).maxExportedSiblingRatio)
    .toBe(0);
  expect(resolveArchitectureOptions({ maxFolderEdgeDensity: 1 }).maxFolderEdgeDensity)
    .toBe(1);
});

it("defaults cacheTtlMs to 5000 and accepts Infinity for unlimited caching", () => {
  expect(resolveArchitectureOptions({}).cacheTtlMs).toBe(5000);
  expect(resolveArchitectureOptions({ cacheTtlMs: 0 }).cacheTtlMs).toBe(0);
  expect(resolveArchitectureOptions({ cacheTtlMs: 60_000 }).cacheTtlMs).toBe(60_000);
  expect(resolveArchitectureOptions({ cacheTtlMs: Infinity }).cacheTtlMs).toBe(Infinity);
  expect(() => resolveArchitectureOptions({ cacheTtlMs: -1 })).toThrowError(
    /cacheTtlMs/,
  );
});

it("Property: schema rejects non-positive and non-integer count options", () => {
  const positiveIntOptions = [
    "minExportedSiblingModules",
    "maxPublicExports",
    "minPublicFacadeModules",
    "minPackageMeshFolders",
    "minExplicitApiConcreteFiles",
    "minImplicitBoundaryIncomingFiles",
    "minImplicitBoundaryOutgoingFiles",
    "minImplicitBoundaryExports",
    "minSharedKernelExports",
    "minSharedKernelConsumers",
  ] as const;
  const nonNegativeIntOptions = [
    "maxSubpathExports",
    "maxWildcardExports",
    "maxPublicReexports",
    "maxFolderCycles",
  ] as const;

  fc.assert(
    fc.property(fc.constantFrom(...positiveIntOptions), (optionName) => {
      expect(() =>
        resolveArchitectureOptions({ [optionName]: 0 }),
      ).toThrowError(new RegExp(optionName));
      expect(() =>
        resolveArchitectureOptions({ [optionName]: 1.5 }),
      ).toThrowError(new RegExp(optionName));
    }),
    { numRuns: 40 },
  );

  fc.assert(
    fc.property(fc.constantFrom(...nonNegativeIntOptions), (optionName) => {
      expect(() =>
        resolveArchitectureOptions({ [optionName]: -1 }),
      ).toThrowError(new RegExp(optionName));
      expect(() =>
        resolveArchitectureOptions({ [optionName]: 1.5 }),
      ).toThrowError(new RegExp(optionName));
    }),
    { numRuns: 40 },
  );
});
