import { expect, it } from "vitest";
import * as h from "../../test-support/helper-fixtures.js";

const {
  fs,
  os,
  path,
  cachedProjectArchitecture,
  clearArchitectureCache,
  resolveArchitectureOptions,
} = h;

function writeFixtureProject(projectRoot: string): void {
  fs.writeFileSync(
    path.join(projectRoot, "package.json"),
    JSON.stringify({
      name: "fixture",
      version: "1.0.0",
      type: "module",
      exports: { ".": "./dist/index.js" },
    }),
  );
  fs.writeFileSync(
    path.join(projectRoot, "tsconfig.json"),
    JSON.stringify({
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
    }),
  );
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
  for (let i = 0; i < 4; i += 1) {
    fs.writeFileSync(
      path.join(projectRoot, "src", `m${i}.ts`),
      `export const M${i} = ${i};\n`,
    );
  }
}

it("WorkspaceCache: clearing one workspace leaves other workspaces intact", () => {
  const rootA = fs.mkdtempSync(path.join(os.tmpdir(), "acg-cache-wsA-"));
  const rootB = fs.mkdtempSync(path.join(os.tmpdir(), "acg-cache-wsB-"));
  try {
    writeFixtureProject(rootA);
    writeFixtureProject(rootB);
    const optionsA = resolveArchitectureOptions({
      projectRoot: rootA,
      minExportedSiblingModules: 1,
      maxExportedSiblingRatio: 0,
    });
    const optionsB = resolveArchitectureOptions({
      projectRoot: rootB,
      minExportedSiblingModules: 1,
      maxExportedSiblingRatio: 0,
    });

    const reportA = cachedProjectArchitecture(optionsA);
    const reportB = cachedProjectArchitecture(optionsB);

    h.clearWorkspaceCache(rootA);

    expect(cachedProjectArchitecture(optionsB)).toBe(reportB);
    expect(cachedProjectArchitecture(optionsA).diagnostics).toEqual(reportA.diagnostics);
  } finally {
    clearArchitectureCache();
    fs.rmSync(rootA, { recursive: true, force: true });
    fs.rmSync(rootB, { recursive: true, force: true });
  }
});

it("watermark: editing package.json invalidates the disk cache", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acg-cache-pkg-"));
  try {
    writeFixtureProject(projectRoot);
    const options = resolveArchitectureOptions({
      projectRoot,
      minExportedSiblingModules: 1,
      maxExportedSiblingRatio: 0,
    });
    const before = cachedProjectArchitecture(options);
    expect(before.diagnostics.length).toBeGreaterThan(0);

    clearArchitectureCache();
    fs.writeFileSync(
      path.join(projectRoot, "package.json"),
      JSON.stringify({ name: "fixture", version: "2.0.0", type: "module", exports: {} }),
    );
    const after = cachedProjectArchitecture(options);
    expect(after).not.toBe(before);
  } finally {
    clearArchitectureCache();
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

it("watermark: editing tsconfig.json invalidates the disk cache", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acg-cache-tscfg-"));
  try {
    writeFixtureProject(projectRoot);
    const options = resolveArchitectureOptions({
      projectRoot,
      minExportedSiblingModules: 1,
      maxExportedSiblingRatio: 0,
    });
    const before = cachedProjectArchitecture(options);
    expect(before.diagnostics.length).toBeGreaterThan(0);

    clearArchitectureCache();
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(projectRoot, "tsconfig.json"), "utf8"),
    ) as { compilerOptions: Record<string, unknown> };
    tsconfig.compilerOptions.allowJs = true;
    fs.writeFileSync(path.join(projectRoot, "tsconfig.json"), JSON.stringify(tsconfig));

    const after = cachedProjectArchitecture(options);
    expect(after).not.toBe(before);
  } finally {
    clearArchitectureCache();
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

it("WorkspaceCache.get: programFingerprint keeps in-memory entries independent and skips disk persist", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acg-cache-fp-"));
  try {
    writeFixtureProject(projectRoot);
    const options = resolveArchitectureOptions({
      projectRoot,
      minExportedSiblingModules: 1,
      maxExportedSiblingRatio: 0,
    });
    const cache = h.getOrCreateWorkspaceCache(projectRoot);
    const r1 = cache.get(options, undefined, "language-service-v1");
    const r2 = cache.get(options, undefined, "language-service-v2");
    expect(r1).not.toBe(r2);
    expect(r1.diagnostics).toEqual(r2.diagnostics);
  } finally {
    clearArchitectureCache();
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});
