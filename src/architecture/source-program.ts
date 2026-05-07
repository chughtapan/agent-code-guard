import path from "node:path";
import ts from "typescript";
import { replaceKnownExtension, SOURCE_EXTENSIONS, withTrailingSeparator } from "./path-utils.js";
import { collectPackageExportEntries } from "./package-exports.js";
import type { NormalizedArchitectureOptions, PackageJson } from "./types.js";

const PUBLIC_ENTRYPOINT_CANDIDATES = [
  "src/index.ts",
  "src/index.tsx",
  "index.ts",
  "index.tsx",
] as const;

export function createProgram(options: NormalizedArchitectureOptions): ts.Program | null {
  const configPath =
    options.tsconfigPath ??
    ts.findConfigFile(options.projectRoot, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) return null;

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  );
  if (parsed.errors.length > 0) return null;

  return ts.createProgram(parsed.fileNames, parsed.options);
}

export function projectSourceFiles(
  program: ts.Program,
  projectRoot: string,
): readonly ts.SourceFile[] {
  const root = withTrailingSeparator(path.resolve(projectRoot));
  return program
    .getSourceFiles()
    .filter((sourceFile) => isProjectSourceFile(sourceFile, root))
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
}

export function findPackageReportFile(
  sourceFiles: readonly ts.SourceFile[],
  projectRoot: string,
): string {
  const sourceFileNames = new Set(
    sourceFiles.map((sourceFile) => path.resolve(sourceFile.fileName)),
  );
  const candidates = PUBLIC_ENTRYPOINT_CANDIDATES.map(
    (candidate) => path.resolve(projectRoot, candidate),
  );

  return (
    candidates.find((candidate) => sourceFileNames.has(candidate)) ??
    sourceFiles[0]?.fileName ??
    path.join(projectRoot, "package.json")
  );
}

export function publicApiSourceFiles(
  program: ts.Program,
  packageJson: PackageJson | null,
  options: NormalizedArchitectureOptions,
): readonly ts.SourceFile[] {
  const projectFiles = projectSourceFiles(program, options.projectRoot);
  const byPath = new Map(
    projectFiles.map((sourceFile) => [path.resolve(sourceFile.fileName), sourceFile] as const),
  );
  const publicFiles = new Set<ts.SourceFile>();

  if (packageJson) {
    for (const entry of collectPackageExportEntries(packageJson)) {
      const sourcePath = sourcePathForPackageTarget(
        entry.targetPath,
        options.projectRoot,
        byPath,
      );
      const sourceFile = sourcePath ? byPath.get(sourcePath) : undefined;
      if (sourceFile) publicFiles.add(sourceFile);
    }
  }

  if (publicFiles.size === 0) {
    for (const candidate of PUBLIC_ENTRYPOINT_CANDIDATES) {
      const sourceFile = byPath.get(path.resolve(options.projectRoot, candidate));
      if (sourceFile) {
        publicFiles.add(sourceFile);
      }
    }
  }

  return [...publicFiles];
}

export function sourcePathForPackageTarget(
  targetPath: string,
  projectRoot: string,
  sourceFiles: ReadonlyMap<string, ts.SourceFile>,
): string | null {
  const normalizedTarget = targetPath.replaceAll("\\", "/");
  const targetWithoutPrefix = normalizedTarget.startsWith("./")
    ? normalizedTarget.slice(2)
    : normalizedTarget;
  const candidates = candidateSourcePaths(targetWithoutPrefix, projectRoot);
  return candidates.find((candidate) => sourceFiles.has(candidate)) ?? null;
}

export function candidateSourcePaths(targetWithoutPrefix: string, projectRoot: string): string[] {
  const relativePaths = targetWithoutPrefix.startsWith("dist/")
    ? [targetWithoutPrefix, `src/${targetWithoutPrefix.slice("dist/".length)}`]
    : [targetWithoutPrefix];

  return relativePaths.flatMap((relativePath) =>
    SOURCE_EXTENSIONS.map((extension) =>
      path.resolve(projectRoot, replaceKnownExtension(relativePath, extension)),
    ),
  );
}

function isProjectSourceFile(sourceFile: ts.SourceFile, projectRootWithSlash: string): boolean {
  const fileName = path.resolve(sourceFile.fileName);
  return (
    fileName.startsWith(projectRootWithSlash) &&
    !sourceFile.isDeclarationFile &&
    !fileName.includes(`${path.sep}node_modules${path.sep}`)
  );
}
