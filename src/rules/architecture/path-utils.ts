import path from "node:path";

export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;
export const OUTPUT_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs"] as const;

export function hasSourceExtension(fileName: string): boolean {
  return SOURCE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

export function stripKnownExtension(fileName: string): string {
  const extension = [".d.ts", ...SOURCE_EXTENSIONS, ...OUTPUT_EXTENSIONS].find((candidate) =>
    fileName.endsWith(candidate),
  );
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

export function replaceKnownExtension(fileName: string, nextExtension: string): string {
  const extension = [".d.ts", ...SOURCE_EXTENSIONS, ...OUTPUT_EXTENSIONS].find((candidate) =>
    fileName.endsWith(candidate),
  );
  return extension
    ? `${fileName.slice(0, -extension.length)}${nextExtension}`
    : `${fileName}${nextExtension}`;
}

export function withTrailingSeparator(directory: string): string {
  return directory.endsWith(path.sep) ? directory : `${directory}${path.sep}`;
}
