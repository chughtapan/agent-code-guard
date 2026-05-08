import { expect, it } from "vitest";
import * as h from "../test-support/helper-fixtures.js";

const { fs, os, path, fc, ts, exportDeclarationIsTypeOnly, exportedSiblingModuleKeys, eligibleSiblingModuleKeys, inventoryBarrelDiagnostic, isExcludedSourceFile, isIndexSourceFile, siblingModuleKeyFromSpecifier, sourceModuleKey, checkPackageExports, packagePathSegments, packageReportPath, pathHasForbiddenSegment, checkPublicVendorTypeLeaks, externalReExportDiagnostics, normalizeTypePackageName, packageAllowedInPublicTypes, packageNameFromFileName, packageNameFromSpecifier, cachedProjectArchitecture, clearArchitectureCache, uniqueDiagnostics, resolveArchitectureOptions, collectExportsValue, collectPackageExportEntries, readPackageJson, candidateSourcePaths, createProgram, findPackageReportFile, projectSourceFiles, publicApiSourceFiles, sourcePathForPackageTarget, folderEdgeDensity, stronglyConnectedFolderComponents, buildProjectGraph, exportedDeclarationName, folderKeyForFile, hasExportModifier, isTestLikePath, isStarExportDeclaration, layerIndexFor, resolveLocalSpecifier, topFolder, hasSourceExtension, OUTPUT_EXTENSIONS, replaceKnownExtension, SOURCE_EXTENSIONS, stripKnownExtension, withTrailingSeparator, segmentArb, packageSegmentArb, scopedPackageArb, sourceExtensionArb, testOnlySegmentArb, exportSourceFileFor, writeSiblingModules, packageJsonForExports, packageExportDiagnostics, diagnosticsForRule, programFromSourceFiles, sourceFileAt, sourceFilesByRelativePath, writePublicTypeProject, writeNodePackage, publicTypeDiagnostics, nestedReadonlyObjectType } = h;

it("maps package targets back to candidate source paths", () => {
  const root = path.resolve("/repo");
  expect(candidateSourcePaths("dist/index.js", root)).toEqual([
    path.resolve(root, "dist/index.ts"),
    path.resolve(root, "dist/index.tsx"),
    path.resolve(root, "dist/index.mts"),
    path.resolve(root, "dist/index.cts"),
    path.resolve(root, "src/index.ts"),
    path.resolve(root, "src/index.tsx"),
    path.resolve(root, "src/index.mts"),
    path.resolve(root, "src/index.cts"),
  ]);

  const sourceFile = ts.createSourceFile(
    path.resolve(root, "src/index.ts"),
    "export const ok = true;",
    ts.ScriptTarget.Latest,
  );
  const sourceFiles = new Map([[path.resolve(root, "src/index.ts"), sourceFile]]);
  expect(sourcePathForPackageTarget("./dist/index.js", root, sourceFiles)).toBe(
    path.resolve(root, "src/index.ts"),
  );
  expect(sourcePathForPackageTarget("dist/index.js", root, sourceFiles)).toBe(
    path.resolve(root, "src/index.ts"),
  );
  expect(sourcePathForPackageTarget(".\\dist\\index.js", root, sourceFiles)).toBe(
    path.resolve(root, "src/index.ts"),
  );
  expect(sourcePathForPackageTarget("./dist/missing.js", root, sourceFiles)).toBeNull();
});

it("Property: package target candidates map dist outputs back to source roots", () => {
  fc.assert(
    fc.property(
      fc.array(segmentArb, { minLength: 1, maxLength: 4 }),
      fc.boolean(),
      (segments, fromDist) => {
        const root = path.resolve("/repo");
        const target = `${fromDist ? "dist/" : ""}${segments.join("/")}.js`;
        const expectedPrefixes = fromDist
          ? [target, `src/${segments.join("/")}.js`]
          : [target];

        expect(candidateSourcePaths(target, root)).toEqual(
          candidatePathsForPrefixes(root, expectedPrefixes),
        );
      },
    ),
    { numRuns: 80 },
  );
});

function candidatePathsForPrefixes(root: string, prefixes: readonly string[]): readonly string[] {
  return prefixes.flatMap((prefix) => candidatePathsForPrefix(root, prefix));
}

function candidatePathsForPrefix(root: string, prefix: string): readonly string[] {
  return SOURCE_EXTENSIONS.map((extension) =>
    path.resolve(root, replaceKnownExtension(prefix, extension)),
  );
}

it("creates TypeScript programs only when configuration can be read and parsed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-source-program-"));
  try {
    expect(createProgram(resolveArchitectureOptions({ projectRoot: root }))).toBeNull();
    expect(
      createProgram(
        resolveArchitectureOptions({
          projectRoot: root,
          tsconfigPath: "missing-tsconfig.json",
        }),
      ),
    ).toBeNull();

    fs.writeFileSync(path.join(root, "tsconfig.json"), "{ invalid json");
    expect(createProgram(resolveArchitectureOptions({ projectRoot: root }))).toBeNull();

    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { module: "DefinitelyNotAModuleKind" } }),
    );
    expect(createProgram(resolveArchitectureOptions({ projectRoot: root }))).toBeNull();

    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "index.ts"), "export const ok = true;\n");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
        },
        include: ["src/**/*"],
      }),
    );

    expect(createProgram(resolveArchitectureOptions({ projectRoot: root }))).not.toBeNull();
    expect(
      createProgram(
        resolveArchitectureOptions({
          projectRoot: path.dirname(root),
          tsconfigPath: path.join(path.basename(root), "tsconfig.json"),
        }),
      ),
    ).not.toBeNull();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it("filters project source files to sorted non-declaration files inside the package root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-project-files-"));
  try {
    const fileNames = [
      path.join(root, "src", "z.ts"),
      path.join(root, "src", "a.ts"),
      path.join(root, "src", "types.d.ts"),
      path.join(root, "node_modules", "dep", "index.ts"),
    ];
    for (const fileName of fileNames) {
      fs.mkdirSync(path.dirname(fileName), { recursive: true });
      fs.writeFileSync(fileName, "export const value = true;\n");
    }

    const program = ts.createProgram(fileNames, {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
    });

    expect(projectSourceFiles(program, root).map((sourceFile) => sourceFile.fileName)).toEqual([
      path.join(root, "src", "a.ts"),
      path.join(root, "src", "z.ts"),
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it("Property: package report file selection follows public entrypoint priority", () => {
  const priority = ["src/index.ts", "src/index.tsx", "index.ts", "index.tsx"];

  fc.assert(
    fc.property(fc.subarray(["src/index.ts", "src/index.tsx", "index.ts", "index.tsx"]), (present) => {
      const root = path.resolve("/repo");
      const sourceFiles = [
        ts.createSourceFile(
          path.resolve(root, "src/not-public.ts"),
          "export const internal = true;",
          ts.ScriptTarget.Latest,
        ),
        ...[...present].reverse().map((relativePath) =>
          ts.createSourceFile(
            path.resolve(root, relativePath),
            "export const ok = true;",
            ts.ScriptTarget.Latest,
          ),
        ),
      ];
      const expectedRelativePath = priority.find((relativePath) =>
        present.includes(relativePath),
      );

      expect(findPackageReportFile(sourceFiles, root)).toBe(
        expectedRelativePath
          ? path.resolve(root, expectedRelativePath)
          : path.resolve(root, "src/not-public.ts"),
      );
    }),
    { numRuns: 20 },
  );

  for (const relativePath of priority) {
    const root = path.resolve("/repo");
    const sourceFiles = [
      ts.createSourceFile(
        path.resolve(root, "src/not-public.ts"),
        "export const internal = true;",
        ts.ScriptTarget.Latest,
      ),
      ts.createSourceFile(
        path.resolve(root, relativePath),
        "export const ok = true;",
        ts.ScriptTarget.Latest,
      ),
    ];
    expect(findPackageReportFile(sourceFiles, root)).toBe(path.resolve(root, relativePath));
  }

  const fallback = ts.createSourceFile("/repo/src/other.ts", "export const ok = true;", ts.ScriptTarget.Latest);
  expect(findPackageReportFile([fallback], "/repo")).toBe(fallback.fileName);
  expect(findPackageReportFile([], "/repo")).toBe(path.join("/repo", "package.json"));
});

it("selects public API source files from package exports and falls back to conventional index files", () => {
  const root = path.resolve("/repo");
  const sourceFiles = ["src/index.ts", "src/cli.ts", "src/private.ts", "src/alt.tsx"].map(
    (relativePath) =>
      ts.createSourceFile(
        path.join(root, relativePath),
        "export const ok = true;\n",
        ts.ScriptTarget.Latest,
      ),
  );
  const program = programFromSourceFiles(sourceFiles);
  const options = resolveArchitectureOptions({ projectRoot: root });
  const packageJson = packageJsonForExports({
    ".": "./dist/index.js",
    "./cli": "./dist/cli.js",
    "./missing": "./dist/missing.js",
  });

  expect(
    publicApiSourceFiles(program, packageJson, options).map((sourceFile) =>
      path.relative(root, sourceFile.fileName).replaceAll("\\", "/"),
    ),
  ).toEqual(["src/index.ts", "src/cli.ts"]);

  expect(
    publicApiSourceFiles(
      program,
      packageJsonForExports({ "./cli": "./dist/cli.js" }),
      options,
    ).map((sourceFile) =>
      path.relative(root, sourceFile.fileName).replaceAll("\\", "/"),
    ),
  ).toEqual(["src/cli.ts"]);

  expect(
    publicApiSourceFiles(program, packageJsonForExports(undefined), options).map((sourceFile) =>
      path.relative(root, sourceFile.fileName).replaceAll("\\", "/"),
    ),
  ).toEqual(["src/index.ts"]);

  const fallbackProgram = programFromSourceFiles([
    ts.createSourceFile(
      path.join(root, "src", "alt.tsx"),
      "export const ok = true;\n",
      ts.ScriptTarget.Latest,
    ),
  ]);

  expect(
    publicApiSourceFiles(fallbackProgram, packageJsonForExports(undefined), options).map((sourceFile) =>
      path.relative(root, sourceFile.fileName).replaceAll("\\", "/"),
    ),
  ).toEqual([]);
});

it("Property: conventional public API fallback follows every index candidate", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("src/index.ts", "src/index.tsx", "index.ts", "index.tsx"),
      (relativePath) => {
        const root = path.resolve("/repo");
        const program = programFromSourceFiles([
          ts.createSourceFile(
            path.join(root, relativePath),
            "export const ok = true;\n",
            ts.ScriptTarget.Latest,
          ),
        ]);

        expect(
          publicApiSourceFiles(
            program,
            packageJsonForExports(undefined),
            resolveArchitectureOptions({ projectRoot: root }),
          ).map((sourceFile) =>
            path.relative(root, sourceFile.fileName).replaceAll("\\", "/"),
          ),
        ).toEqual([relativePath]);
      },
    ),
    { numRuns: 20 },
  );
});
