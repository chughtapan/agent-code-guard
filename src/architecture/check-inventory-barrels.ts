import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { SOURCE_EXTENSIONS, stripKnownExtension } from "./path-utils.js";
import type { NormalizedArchitectureOptions, ArchitectureDiagnostic } from "./types.js";

export function checkInventoryBarrels(
  sourceFiles: readonly ts.SourceFile[],
  options: NormalizedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  return sourceFiles.flatMap((sourceFile) =>
    inventoryBarrelDiagnostic(sourceFile, options),
  );
}

export function inventoryBarrelDiagnostic(
  sourceFile: ts.SourceFile,
  options: NormalizedArchitectureOptions,
): readonly ArchitectureDiagnostic[] {
  if (!isIndexSourceFile(sourceFile.fileName)) return [];

  const eligibleSiblingModules = eligibleSiblingModuleKeys(path.dirname(sourceFile.fileName));
  const exportedEligibleSiblingModules = intersectSets(
    exportedSiblingModuleKeys(sourceFile, options),
    eligibleSiblingModules,
  );
  const exportedCount = exportedEligibleSiblingModules.size;
  const eligibleCount = eligibleSiblingModules.size;

  if (eligibleCount === 0) return [];
  if (exportedCount < options.minExportedSiblingModules) return [];
  if (exportedCount / eligibleCount < options.maxExportedSiblingRatio) return [];

  return [
    {
      ruleId: "no-inventory-barrel",
      file: sourceFile.fileName,
      severity: "warn",
      message:
        `${path.relative(options.projectRoot, sourceFile.fileName)} exports ` +
        `${exportedCount} of ${eligibleCount} eligible sibling modules. ` +
        "This exports inventory, not an abstraction. Export a smaller facade: " +
        "ports, factories, and stable types only.",
    },
  ];
}

export function isIndexSourceFile(fileName: string): boolean {
  const parsed = path.parse(fileName);
  return (
    parsed.name === "index" &&
    SOURCE_EXTENSIONS.some((extension) => parsed.ext === extension)
  );
}

export function eligibleSiblingModuleKeys(directory: string): ReadonlySet<string> {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const keys = new Set<string>();

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    if (entry.isDirectory()) {
      if (directoryHasIndexSource(path.join(directory, entry.name))) keys.add(entry.name);
      continue;
    }

    const moduleKey = sourceModuleKey(entry.name);
    if (moduleKey !== null) keys.add(moduleKey);
  }

  return keys;
}

export function directoryHasIndexSource(directory: string): boolean {
  return SOURCE_EXTENSIONS.some((extension) =>
    fs.existsSync(path.join(directory, `index${extension}`)),
  );
}

export function sourceModuleKey(fileName: string): string | null {
  if (isExcludedSourceFile(fileName)) return null;

  const extension = SOURCE_EXTENSIONS.find((candidate) => fileName.endsWith(candidate));
  return extension ? fileName.slice(0, -extension.length) : null;
}

export function isExcludedSourceFile(fileName: string): boolean {
  return (
    fileName.startsWith("index.") ||
    fileName.endsWith(".d.ts") ||
    /\.(test|spec|stories)\.[cm]?[tj]sx?$/.test(fileName) ||
    /\.generated\.[cm]?[tj]sx?$/.test(fileName)
  );
}

export function exportedSiblingModuleKeys(
  sourceFile: ts.SourceFile,
  options: Pick<NormalizedArchitectureOptions, "countTypeOnlyExports">,
): ReadonlySet<string> {
  const keys = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    if (!options.countTypeOnlyExports && exportDeclarationIsTypeOnly(statement)) continue;
    if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;

    const moduleKey = siblingModuleKeyFromSpecifier(statement.moduleSpecifier.text);
    if (moduleKey !== null) keys.add(moduleKey);
  }

  return keys;
}

export function exportDeclarationIsTypeOnly(statement: ts.ExportDeclaration): boolean {
  if (statement.isTypeOnly) return true;
  if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) return false;
  return statement.exportClause.elements.every((specifier) => specifier.isTypeOnly);
}

export function siblingModuleKeyFromSpecifier(specifier: string): string | null {
  if (!specifier.startsWith("./")) return null;

  const segments = stripKnownExtension(specifier.slice(2))
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment.length > 0);

  if (segments.length === 1) return segments[0] === "index" ? null : segments[0] ?? null;
  if (segments.length === 2 && segments[1] === "index") return segments[0] ?? null;
  return null;
}

function intersectSets<T>(left: ReadonlySet<T>, right: ReadonlySet<T>): ReadonlySet<T> {
  return new Set([...left].filter((value) => right.has(value)));
}
