import ts from "typescript";
import { uniqueDiagnostics } from "./diagnostics.js";
import { publicApiSourceFiles } from "./source-program.js";
import type {
  NormalizedTopologyOptions,
  PackageJson,
  TopologyDiagnostic,
  TopologySeverity,
} from "./types.js";

const MAX_TYPE_DEPTH = 8;

export function checkPublicVendorTypeLeaks(
  program: ts.Program | null,
  packageJson: PackageJson | null,
  options: NormalizedTopologyOptions,
): readonly TopologyDiagnostic[] {
  if (!program) return [];

  const checker = program.getTypeChecker();
  const diagnostics = publicApiSourceFiles(program, packageJson, options).flatMap(
    (sourceFile) => [
      ...externalReExportDiagnostics(sourceFile, options),
      ...exportedSignatureDiagnostics(checker, sourceFile, packageJson, options),
    ],
  );

  return uniqueDiagnostics(diagnostics);
}

export function externalReExportDiagnostics(
  sourceFile: ts.SourceFile,
  options: NormalizedTopologyOptions,
): readonly TopologyDiagnostic[] {
  return sourceFile.statements.flatMap((statement) => {
    if (!ts.isExportDeclaration(statement)) return [];
    if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) return [];

    const packageName = packageNameFromSpecifier(statement.moduleSpecifier.text);
    if (packageName === null || packageAllowedInPublicTypes(packageName, options)) return [];

    return [
      {
        ruleId: "no-public-vendor-type-leak",
        file: sourceFile.fileName,
        severity: publicTypeLeakSeverity(packageName, null),
        message:
          `Public API re-exports "${packageName}" types from "${statement.moduleSpecifier.text}". ` +
          "Wrap vendor types behind domain-owned public types, or list the package in " +
          "publicTypePackages when it is intentionally part of the contract.",
      },
      ...infraTypeLeakDiagnostic(sourceFile.fileName, packageName, options),
    ];
  });
}

export function packageNameFromSpecifier(specifier: string): string | null {
  if (specifier.startsWith(".")) return null;
  if (specifier.startsWith("node:")) return "node";

  const [firstSegment, secondSegment] = specifier.split("/");
  if (!firstSegment) return null;
  if (firstSegment.startsWith("@")) {
    return secondSegment ? `${firstSegment}/${secondSegment}` : firstSegment;
  }

  return firstSegment;
}

export function packageNameFromFileName(fileName: string): string | null {
  const normalized = fileName.replaceAll("\\", "/");
  if (/\/node_modules\/typescript\/lib\/lib\..+\.d\.ts$/.test(normalized)) return null;

  const marker = "/node_modules/";
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) {
    return /\/(__generated__|generated)\//.test(normalized) ? "generated-vendor" : null;
  }

  const afterNodeModules = normalized.slice(markerIndex + marker.length);
  const rawPackageName = packageNameFromNodeModulesPath(afterNodeModules);
  return rawPackageName ? normalizeTypePackageName(rawPackageName) : null;
}

export function normalizeTypePackageName(packageName: string): string {
  if (!packageName.startsWith("@types/")) return packageName;

  const withoutPrefix = packageName.slice("@types/".length);
  const scopedMatch = /^([^_]+)__([^_]+)$/.exec(withoutPrefix);
  return scopedMatch ? `@${scopedMatch[1]}/${scopedMatch[2]}` : withoutPrefix;
}

export function packageAllowedInPublicTypes(
  packageName: string,
  options: Pick<NormalizedTopologyOptions, "packageRuntime" | "publicTypePackages">,
): boolean {
  if (options.publicTypePackages.includes(packageName)) return true;
  if (packageName !== "node") return false;
  return options.packageRuntime === "node";
}

function exportedSignatureDiagnostics(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  packageJson: PackageJson | null,
  options: NormalizedTopologyOptions,
): readonly TopologyDiagnostic[] {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) return [];

  return checker.getExportsOfModule(moduleSymbol).flatMap((exportedSymbol) => {
    const declaration = exportedSymbol.valueDeclaration ?? exportedSymbol.declarations?.[0];
    if (!declaration) return [];

    const exportedType = typeForExportedSymbol(checker, exportedSymbol, declaration);
    const leakedPackages = externalPackagesFromType(
      checker,
      exportedType,
      declaration,
      options,
    );

    return [...leakedPackages].flatMap((packageName) => [
      {
        ruleId: "no-public-vendor-type-leak",
        file: sourceFile.fileName,
        severity: publicTypeLeakSeverity(packageName, packageJson),
        message:
          `Public API export "${exportedSymbol.getName()}" references "${packageName}" ` +
          "types. Wrap vendor types behind domain-owned public types, or list the " +
          "package in publicTypePackages when it is intentionally part of the contract.",
      },
      ...infraTypeLeakDiagnostic(sourceFile.fileName, packageName, options),
    ]);
  });
}

function publicTypeLeakSeverity(
  packageName: string,
  packageJson: PackageJson | null,
): TopologySeverity {
  if (packageName === "node") return "warn";
  return packageJson?.peerDependencies.has(packageName) ? "warn" : "error";
}

function infraTypeLeakDiagnostic(
  fileName: string,
  packageName: string,
  options: NormalizedTopologyOptions,
): readonly TopologyDiagnostic[] {
  if (!options.infrastructureTypePackages.includes(packageName)) return [];

  return [
    {
      ruleId: "no-public-infra-type-leak",
      file: fileName,
      severity: "error",
      message:
        `Public API references infrastructure package "${packageName}". Database, ` +
        "logging, transport, and SDK implementation choices should be hidden behind " +
        "package-owned ports or DTOs.",
    },
  ];
}

function typeForExportedSymbol(
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  declaration: ts.Declaration,
): ts.Type {
  if (ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration)) {
    return checker.getDeclaredTypeOfSymbol(symbol);
  }

  return checker.getTypeOfSymbolAtLocation(symbol, declaration);
}

function externalPackagesFromType(
  checker: ts.TypeChecker,
  type: ts.Type,
  location: ts.Node,
  options: NormalizedTopologyOptions,
): ReadonlySet<string> {
  const packages = new Set<string>();
  const seenTypes = new Set<ts.Type>();

  const visit = (currentType: ts.Type, depth: number): void => {
    if (depth > MAX_TYPE_DEPTH || seenTypes.has(currentType)) return;
    seenTypes.add(currentType);

    const owningPackage = packageNameFromType(currentType);
    if (owningPackage) {
      if (!packageAllowedInPublicTypes(owningPackage, options)) packages.add(owningPackage);
      visitTypeArguments(checker, currentType, depth, visit);
      return;
    }

    visitCompositeType(checker, currentType, location, depth, visit);
  };

  visit(type, 0);
  return packages;
}

function visitCompositeType(
  checker: ts.TypeChecker,
  type: ts.Type,
  location: ts.Node,
  depth: number,
  visit: (type: ts.Type, depth: number) => void,
): void {
  if (type.isUnionOrIntersection()) {
    for (const member of type.types) visit(member, depth + 1);
  }

  visitTypeArguments(checker, type, depth, visit);

  for (const signature of [
    ...type.getCallSignatures(),
    ...type.getConstructSignatures(),
  ]) {
    visit(signature.getReturnType(), depth + 1);
    for (const parameter of signature.getParameters()) {
      const declaration = parameter.valueDeclaration ?? parameter.declarations?.[0] ?? location;
      visit(checker.getTypeOfSymbolAtLocation(parameter, declaration), depth + 1);
    }
  }

  for (const property of type.getProperties()) {
    const declaration = property.declarations?.[0];
    if (declaration) visit(checker.getTypeOfSymbolAtLocation(property, declaration), depth + 1);
  }
}

function visitTypeArguments(
  checker: ts.TypeChecker,
  type: ts.Type,
  depth: number,
  visit: (type: ts.Type, depth: number) => void,
): void {
  for (const argument of checker.getTypeArguments(type as ts.TypeReference)) {
    visit(argument, depth + 1);
  }
}

function packageNameFromType(type: ts.Type): string | null {
  const aliasPackage = packageNameFromSymbol(type.aliasSymbol);
  return aliasPackage ?? packageNameFromSymbol(type.symbol);
}

function packageNameFromSymbol(symbol: ts.Symbol | undefined): string | null {
  const declarations = symbol?.getDeclarations() ?? [];
  for (const declaration of declarations) {
    const packageName = packageNameFromFileName(declaration.getSourceFile().fileName);
    if (packageName !== null) return packageName;
  }

  return null;
}

function packageNameFromNodeModulesPath(afterNodeModules: string): string | null {
  const [firstSegment, secondSegment] = afterNodeModules.split("/");
  return firstSegment.startsWith("@") && secondSegment
    ? `${firstSegment}/${secondSegment}`
    : firstSegment;
}
