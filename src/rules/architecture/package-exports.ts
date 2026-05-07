import type { PackageExportEntry, PackageJson } from "./types.js";
import { isJsonObject } from "./package-json.js";

export function collectPackageExportEntries(
  packageJson: PackageJson,
): readonly PackageExportEntry[] {
  if (packageJson.exports !== undefined) {
    return collectExportsValue(packageJson.exports, ".");
  }

  const entries: PackageExportEntry[] = [];
  if (packageJson.main) entries.push({ publicPath: ".", targetPath: packageJson.main });
  if (packageJson.types) entries.push({ publicPath: ".", targetPath: packageJson.types });
  return entries;
}

export function collectExportsValue(
  value: unknown,
  publicPath: string,
): readonly PackageExportEntry[] {
  if (typeof value === "string") return [{ publicPath, targetPath: value }];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectExportsValue(item, publicPath));
  }
  if (!isJsonObject(value)) return [];

  const entries = Object.entries(value);
  const hasSubpathKeys = entries.some(([key]) => key === "." || key.startsWith("./"));

  if (hasSubpathKeys) {
    return entries.flatMap(([key, nestedValue]) =>
      key === "." || key.startsWith("./") ? collectExportsValue(nestedValue, key) : [],
    );
  }

  return entries.flatMap(([, nestedValue]) => collectExportsValue(nestedValue, publicPath));
}
