/**
 * @file Generates deterministic TypeScript benchmark fixture projects at each supported scale.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const FIXTURES_ROOT = path.join(HERE, "fixtures");

const SIZES = {
  small: { files: 50, filesPerFolder: 10, projectService: false },
  medium: { files: 500, filesPerFolder: 15, projectService: false },
  large: { files: 1_500, filesPerFolder: 20, projectService: false },
  "large-ps": { files: 1_500, filesPerFolder: 20, projectService: true },
  xlarge: { files: 5_000, filesPerFolder: 25, projectService: false },
} as const;

type SizeName = keyof typeof SIZES;

interface FileSpec {
  readonly relPath: string;
  readonly imports: readonly string[];
  readonly exportNames: readonly string[];
}

const fileBodyOverride = new Map<string, string>();

function main(): void {
  const arg = process.argv[2];
  const targets: readonly string[] = arg ? [arg] : Object.keys(SIZES);
  for (const size of targets) {
    if (!isSizeName(size)) {
      console.error(`unknown size: ${size}. valid: ${Object.keys(SIZES).join(", ")}`);
      process.exit(1);
    }
    const dir = generateFixture(size);
    const fileCount = SIZES[size].files;
    console.log(`generated ${size}: ${fileCount} files at ${path.relative(REPO_ROOT, dir)}`);
  }
}

function isSizeName(value: string): value is SizeName {
  return value in SIZES;
}

function generateFixture(size: SizeName): string {
  const fixtureDir = path.join(FIXTURES_ROOT, size);
  rmrf(fixtureDir);
  fs.mkdirSync(fixtureDir, { recursive: true });

  const specs = planFiles(size);
  writeRootIndex(fixtureDir, specs);

  for (const spec of specs) {
    writeFile(path.join(fixtureDir, spec.relPath), renderFile(spec));
  }

  writeTsconfig(fixtureDir);
  writePackageJson(fixtureDir, size);
  writeEslintConfig(fixtureDir, size);

  return fixtureDir;
}

function rmrf(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function planFiles(size: SizeName): readonly FileSpec[] {
  const { files, filesPerFolder } = SIZES[size];
  const folderCount = Math.max(1, Math.ceil(files / filesPerFolder));
  const rng = mulberry32(1729 + files);
  const moduleSpecs = planModuleFiles(files, filesPerFolder, rng);
  return [...moduleSpecs, ...planFolderIndexFiles(moduleSpecs, folderCount)];
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function planModuleFiles(
  files: number,
  filesPerFolder: number,
  rng: () => number,
): readonly FileSpec[] {
  const specs: FileSpec[] = [];

  for (let i = 0; i < files; i++) {
    const folderIdx = Math.floor(i / filesPerFolder);
    const fileIdx = i % filesPerFolder;
    const folder = `domain${pad(folderIdx, 3)}`;
    const baseName = `mod${pad(fileIdx, 3)}`;
    const relPath = `src/${folder}/${baseName}.ts`;

    const exportNames = [`fn${pad(i, 4)}`];

    const imports: string[] = [];
    if (i > 0 && rng() < 0.6) {
      imports.push(renderImportLine(relPath, specs[Math.floor(rng() * i)]));
    }

    specs.push({ relPath, imports, exportNames });
  }

  return specs;
}

function planFolderIndexFiles(
  moduleSpecs: readonly FileSpec[],
  folderCount: number,
): readonly FileSpec[] {
  const indexSpecs: FileSpec[] = [];

  for (let folderIdx = 0; folderIdx < folderCount; folderIdx++) {
    const folder = `domain${pad(folderIdx, 3)}`;
    const folderFiles = moduleSpecs.filter((s) => s.relPath.startsWith(`src/${folder}/`));
    if (folderFiles.length === 0) {
      continue;
    }
    const relPath = `src/${folder}/index.ts`;
    indexSpecs.push({ relPath, imports: [], exportNames: [] });
    fileBodyOverride.set(relPath, renderFolderIndexBody(folderFiles));
  }

  return indexSpecs;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function renderImportLine(fromRelPath: string, target: FileSpec): string {
  const importPath = path
    .relative(path.dirname(fromRelPath), target.relPath)
    .replace(/\.ts$/, ".js");
  const importSpec = importPath.startsWith(".") ? importPath : `./${importPath}`;
  return `import { ${target.exportNames[0]} } from "${importSpec}";`;
}

function renderFolderIndexBody(folderFiles: readonly FileSpec[]): string {
  const lines = folderFiles.map((spec) => {
    const base = path.basename(spec.relPath, ".ts");
    return `export { ${spec.exportNames[0]} } from "./${base}.js";`;
  });
  return lines.join("\n") + "\n";
}

function writeRootIndex(fixtureDir: string, specs: readonly FileSpec[]): void {
  const indexExports = specs
    .filter((s) => s.relPath.endsWith("/index.ts") && s.relPath !== "src/index.ts")
    .map((s) => {
      const folder = path.basename(path.dirname(s.relPath));
      return `export * from "./${folder}/index.js";`;
    })
    .join("\n");
  writeFile(path.join(fixtureDir, "src/index.ts"), indexExports + "\n");
}

function writeTsconfig(fixtureDir: string): void {
  writeFile(
    path.join(fixtureDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          declaration: false,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ) + "\n",
  );
}

function writePackageJson(fixtureDir: string, size: SizeName): void {
  writeFile(
    path.join(fixtureDir, "package.json"),
    JSON.stringify(
      {
        name: `bench-fixture-${size}`,
        version: "0.0.0",
        private: true,
        type: "module",
        main: "src/index.ts",
        exports: { ".": "./src/index.ts" },
      },
      null,
      2,
    ) + "\n",
  );
}

function writeEslintConfig(fixtureDir: string, size: SizeName): void {
  const pluginEntry = path.relative(fixtureDir, path.join(REPO_ROOT, "dist/index.js"));
  const parserOptions = SIZES[size].projectService
    ? `{ ecmaVersion: 2022, sourceType: "module", projectService: true, tsconfigRootDir: import.meta.dirname }`
    : `{ ecmaVersion: 2022, sourceType: "module" }`;
  writeFile(
    path.join(fixtureDir, "eslint.config.js"),
    `import guard from "${pluginEntry}";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: ${parserOptions},
    },
    plugins: guard.configs.recommended.plugins,
    settings: guard.configs.recommended.settings,
    rules: guard.configs.recommended.rules,
  },
  { ignores: ["node_modules/**", "dist/**"] },
];
`,
  );
}

function renderFile(spec: FileSpec): string {
  const override = fileBodyOverride.get(spec.relPath);
  if (override !== undefined) {
    return override;
  }
  const importsBlock = spec.imports.length > 0 ? spec.imports.join("\n") + "\n\n" : "";
  const bodyLines = spec.exportNames.map(
    (name) => `export function ${name}(): number {\n  return ${name.length};\n}`,
  );
  return `${importsBlock}${bodyLines.join("\n\n")}\n`;
}

function writeFile(absPath: string, content: string): void {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

main();
