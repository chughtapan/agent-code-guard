/**
 * @file Plain-Node fixture helpers for engine tests. Lives outside
 * the Effect-shaped test file so the lint rule that flags raw
 * `node:fs` in Effect files doesn't trip on temp-dir scaffolding.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempDirs = new Set<string>();

/**
 * Create a temp dir with a minimal TS project the analyzer can lint.
 * @returns The absolute project root.
 */
export function makeFixtureProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-engine-"));
  tempDirs.add(root);
  writeFixtureProject(root);
  return root;
}

/**
 * Remove every fixture dir created during this test run. Tests call
 * this in `afterEach` so temp dirs don't leak.
 */
export function cleanupFixtures(): void {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs.clear();
}

/**
 * Append a write to one of the fixture project's source files. Used
 * to trigger watcher events.
 * @param projectRoot Absolute project root from `makeFixtureProject`.
 * @param relativePath Path under the project root (e.g. `src/m0.ts`).
 * @param contents File contents to write.
 */
export function writeFile(projectRoot: string, relativePath: string, contents: string): void {
  fs.writeFileSync(path.join(projectRoot, relativePath), contents);
}

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
