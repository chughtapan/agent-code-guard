import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";
import * as fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import plugin from "../src/index.js";
import { analyzeProjectTopology } from "../src/topology/analyze-project.js";
import { clearTopologyCache } from "../src/topology/cache.js";
import type { TopologyDiagnostic, TopologyOptions } from "../src/topology/types.js";

const tempRoots: string[] = [];
const segmentArb = fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/);
const ratioArb = fc.constantFrom(0, 0.25, 0.5, 0.6, 0.75, 1);

afterEach(() => {
  clearTopologyCache();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function makeProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-topology-"));
  tempRoots.push(root);

  const withDefaults = {
    "package.json": JSON.stringify(
      {
        name: "fixture",
        version: "1.0.0",
        type: "module",
        exports: {
          ".": {
            import: "./dist/index.js",
            types: "./dist/index.d.ts",
          },
        },
      },
      null,
      2,
    ),
    "tsconfig.json": JSON.stringify(
      {
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
      },
      null,
      2,
    ),
    "src/index.ts": "export interface PublicApi { readonly id: string; }\n",
    ...files,
  };

  for (const [relativePath, contents] of Object.entries(withDefaults)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }

  return root;
}

function diagnosticsFor(
  root: string,
  options: Omit<TopologyOptions, "projectRoot"> = {},
): readonly TopologyDiagnostic[] {
  return analyzeProjectTopology({ projectRoot: root, ...options }).diagnostics;
}

function diagnosticsByRule(
  root: string,
  ruleId: TopologyDiagnostic["ruleId"],
  options: Omit<TopologyOptions, "projectRoot"> = {},
): readonly TopologyDiagnostic[] {
  return diagnosticsFor(root, options).filter((diagnostic) => diagnostic.ruleId === ruleId);
}

function diagnosticMessages(
  root: string,
  options: Omit<TopologyOptions, "projectRoot"> = {},
): readonly string[] {
  return diagnosticsFor(root, options).map((diagnostic) => diagnostic.message);
}

function sourceModuleFiles(
  directory: string,
  moduleCount: number,
): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: moduleCount }, (_, index) => [
      `${directory}/m${index}.ts`,
      `export const M${index} = ${index};\n`,
    ]),
  );
}

function barrelExports(directory: string, exportCount: number): string {
  return Array.from(
    { length: exportCount },
    (_, index) => `export { M${index} } from "./m${index}";`,
  ).join("\n");
}

function packageJsonWithExports(exportsValue: unknown): string {
  return JSON.stringify(
    {
      name: "fixture",
      version: "1.0.0",
      type: "module",
      exports: exportsValue,
    },
    null,
    2,
  );
}

function packageJsonWithDependency(packageName: string): string {
  return JSON.stringify(
    {
      name: "fixture",
      version: "1.0.0",
      type: "module",
      dependencies: { [packageName]: "1.0.0" },
      exports: {
        ".": {
          import: "./dist/index.js",
          types: "./dist/index.d.ts",
        },
      },
    },
    null,
    2,
  );
}

function nodeModuleTypePackage(packageName: string, typeName: string): Record<string, string> {
  return {
    [`node_modules/${packageName}/package.json`]: JSON.stringify({
      name: packageName,
      version: "1.0.0",
      types: "index.d.ts",
    }),
    [`node_modules/${packageName}/index.d.ts`]:
      `export interface ${typeName}<T = unknown> { readonly id: string; readonly value?: T; }\n`,
  };
}

function hasRule(
  diagnostics: readonly TopologyDiagnostic[],
  ruleId: TopologyDiagnostic["ruleId"],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.ruleId === ruleId);
}

describe("topology analyzer", () => {
  it("Property: inventory barrels fire exactly when exported sibling count crosses count and ratio thresholds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 1, max: 9 }),
        ratioArb,
        (eligibleCount, rawExportCount, minExportedSiblingModules, maxExportedSiblingRatio) => {
          const exportedCount = Math.min(rawExportCount, eligibleCount);
          const root = makeProject({
            "src/widgets/index.ts": barrelExports("src/widgets", exportedCount),
            ...sourceModuleFiles("src/widgets", eligibleCount),
            "src/widgets/ignored.test.ts": "export const ignored = true;\n",
          });
          const shouldFlag =
            exportedCount >= minExportedSiblingModules &&
            exportedCount / eligibleCount >= maxExportedSiblingRatio;

          expect(
            hasRule(
              diagnosticsFor(root, {
                minExportedSiblingModules,
                maxExportedSiblingRatio,
              }),
              "no-inventory-barrel",
            ),
          ).toBe(shouldFlag);
        },
      ),
      { numRuns: 4 },
    );
  });

  it("flags internal and wildcard package exports", () => {
    const root = makeProject({
      "package.json": packageJsonWithExports({
        ".": "./dist/index.js",
        "./internal/*": "./dist/internal/*.js",
        "./utils": "./dist/utils/index.js",
      }),
    });

    expect(diagnosticMessages(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('export "./internal/*" exposes implementation path'),
        expect.stringContaining('export "./utils" exposes implementation path'),
        expect.stringContaining('export "./internal/*" is a wildcard public surface'),
      ]),
    );
  });

  it("flags public test helper and implementation-shaped package exports", () => {
    const root = makeProject({
      "package.json": packageJsonWithExports({
        ".": "./dist/index.js",
        "./test-utils": "./dist/test-utils/index.js",
        "./driver": "./dist/db/driver.js",
      }),
      "src/test-utils/index.ts": "export const testHelper = true;\n",
      "src/db/driver.ts": "export const driver = true;\n",
    });

    expect(diagnosticMessages(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('export "./test-utils" exposes test-only path'),
        expect.stringContaining('export "./driver" points at implementation-shaped path'),
      ]),
    );
  });

  it("allows explicitly public subpaths", () => {
    const root = makeProject({
      "package.json": packageJsonWithExports({
        ".": "./dist/index.js",
        "./cli": "./dist/cli.js",
        "./testing": "./dist/testing/index.js",
      }),
      "src/cli.ts": "export const cli = true;\n",
      "src/testing/index.ts": "export const testing = true;\n",
    });

    expect(diagnosticMessages(root)).not.toContainEqual(
      expect.stringContaining("package.json export"),
    );
  });

  it("flags export-star public boundaries and uncurated public facades", () => {
    const root = makeProject({
      "src/index.ts": [
        'export * from "./a";',
        'export { B } from "./b";',
      ].join("\n"),
      "src/a.ts": "export const A = true;\n",
      "src/b.ts": "export const B = true;\n",
    });

    expect(diagnosticMessages(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("uses 1 export-star boundary declaration"),
        expect.stringContaining("is a public facade"),
      ]),
    );
  });

  it("Property: public reexport fanout fires exactly when it exceeds the configured budget", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 18 }),
        fc.integer({ min: 0, max: 18 }),
        (reexportCount, maxPublicReexports) => {
          const root = makeProject({
            "src/index.ts": barrelExports("src", reexportCount),
            ...sourceModuleFiles("src", reexportCount),
          });

          expect(
            diagnosticsByRule(root, "no-large-public-surface", {
              maxPublicExports: 100,
              maxPublicReexports,
            }).some((diagnostic) => diagnostic.message.includes("re-exports")),
          ).toBe(reexportCount > maxPublicReexports);
        },
      ),
      { numRuns: 8 },
    );
  });

  it("Property: public vendor type leaks follow the configured public type allowlist", () => {
    fc.assert(
      fc.property(segmentArb, fc.boolean(), (packageName, allowed) => {
        const typeName = "VendorShape";
        const root = makeProject({
          "package.json": packageJsonWithDependency(packageName),
          ...nodeModuleTypePackage(packageName, typeName),
          "src/index.ts": [
            `import type { ${typeName} } from "${packageName}";`,
            "export interface PublicShape {",
            `  readonly raw: ${typeName};`,
            "}",
          ].join("\n"),
        });

        expect(
          hasRule(
            diagnosticsFor(root, { publicTypePackages: allowed ? [packageName] : [] }),
            "no-public-vendor-type-leak",
          ),
        ).toBe(!allowed);
      }),
      { numRuns: 8 },
    );
  });

  it("flags infrastructure type leaks and non-owned public boundary types", () => {
    const root = makeProject({
      "package.json": packageJsonWithDependency("kysely"),
      ...nodeModuleTypePackage("kysely", "Kysely"),
      "src/index.ts": [
        'import type { Kysely } from "kysely";',
        "export interface PublicDb {",
        "  readonly raw: Kysely<{ readonly id: string }>;",
        "}",
      ].join("\n"),
    });

    expect(diagnosticMessages(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('export "PublicDb" references "kysely" types'),
        expect.stringContaining('references infrastructure package "kysely"'),
        expect.stringContaining('export "PublicDb" mentions "kysely" directly'),
      ]),
    );
  });

  it("allows public vendor types when the package is declared as public API", () => {
    const root = makeProject({
      "package.json": packageJsonWithDependency("openai"),
      ...nodeModuleTypePackage("openai", "ChatCompletion"),
      "src/index.ts": [
        'import type { ChatCompletion } from "openai";',
        "export interface ChatResult {",
        "  readonly raw: ChatCompletion;",
        "}",
      ].join("\n"),
    });

    const diagnostics = analyzeProjectTopology({
      projectRoot: root,
      publicTypePackages: ["openai"],
    }).diagnostics;

    expect(diagnostics).not.toContainEqual(
      expect.objectContaining({ ruleId: "no-public-vendor-type-leak" }),
    );
  });

  it("warns for Node built-in public types unless the package is Node-facing", () => {
    const root = makeProject({
      "src/index.ts": [
        'import type { Readable } from "node:stream";',
        "export interface StreamResult {",
        "  readonly body: Readable;",
        "}",
      ].join("\n"),
    });

    const universalDiagnostics = diagnosticsFor(root);
    expect(universalDiagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "no-public-vendor-type-leak",
        severity: "warn",
      }),
    );

    const nodeDiagnostics = diagnosticsFor(root, {
      packageRuntime: "node",
    });
    expect(nodeDiagnostics).not.toContainEqual(
      expect.objectContaining({ ruleId: "no-public-vendor-type-leak" }),
    );
  });

  it("flags folder cycles, root/internal cycles, sibling domain imports, and upward imports", () => {
    const root = makeProject({
      "src/index.ts": [
        'import { internalValue } from "./internal/value";',
        "export const rootValue = internalValue;",
      ].join("\n"),
      "src/internal/value.ts": [
        'import { rootValue } from "../index";',
        "export const internalValue = rootValue;",
      ].join("\n"),
      "src/billing/charge.ts": [
        'import { sendReceipt } from "../mail/send-receipt";',
        "export const charge = sendReceipt;",
      ].join("\n"),
      "src/mail/send-receipt.ts": "export const sendReceipt = true;\n",
      "src/feature/use-root.ts": [
        'import { rootValue } from "../index";',
        "export const useRoot = rootValue;",
      ].join("\n"),
    });

    expect(diagnosticMessages(root)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Folder dependency cycle"),
        expect.stringContaining("Root files and internal files depend on each other"),
        expect.stringContaining("imports src/mail/send-receipt.ts across sibling domains"),
        expect.stringContaining("imports upward into src/index.ts"),
      ]),
    );
  });

  it("Property: folder cycles and package mesh follow generated folder dependency shape", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(segmentArb, { minLength: 2, maxLength: 7 }),
        fc.boolean(),
        (folders, closeCycle) => {
          const files: Record<string, string> = {
            "src/index.ts": "export const ok = true;\n",
          };

          for (const [index, folder] of folders.entries()) {
            const next = folders[index + 1] ?? (closeCycle ? folders[0] : null);
            files[`src/${folder}/index.ts`] = next
              ? `import { value as next } from "../${next}/index"; export const value = next;\n`
              : "export const value = true;\n";
          }

          const root = makeProject(files);
          const diagnostics = diagnosticsFor(root, {
            minPackageMeshFolders: folders.length,
            maxFolderEdgeDensity: 1,
          });

          expect(hasRule(diagnostics, "no-folder-cycle")).toBe(closeCycle);
          expect(hasRule(diagnostics, "no-package-mesh")).toBe(closeCycle);
        },
      ),
      { numRuns: 8 },
    );
  });

  it("surfaces topology diagnostics through the ESLint rule", () => {
    const root = makeProject({
      "src/widgets/index.ts": [
        'export { A } from "./a";',
        'export { B } from "./b";',
        'export { C } from "./c";',
        'export { D } from "./d";',
      ].join("\n"),
      "src/widgets/a.ts": "export const A = 1;\n",
      "src/widgets/b.ts": "export const B = 1;\n",
      "src/widgets/c.ts": "export const C = 1;\n",
      "src/widgets/d.ts": "export const D = 1;\n",
      "src/widgets/e.ts": "export const E = 1;\n",
    });
    const filename = path.join(root, "src", "widgets", "index.ts");
    const lintFilename = path.join("src", "widgets", "index.ts");
    const linter = new Linter({ cwd: root });
    const messages = linter.verify(
      fs.readFileSync(filename, "utf8"),
      [
        {
          files: ["**/*.ts"],
          languageOptions: {
            parser: tsParser as Linter.Parser,
            parserOptions: { ecmaVersion: 2022, sourceType: "module" },
          },
          plugins: { "agent-code-guard": plugin },
          rules: {
            "agent-code-guard/topology-boundaries": ["error", { projectRoot: root }],
          },
        },
      ],
      { filename: lintFilename },
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain("This exports inventory");
  });

  it("surfaces topology diagnostics through individual ESLint rules", () => {
    const root = makeProject({
      "src/widgets/index.ts": [
        'export { A } from "./a";',
        'export { B } from "./b";',
        'export { C } from "./c";',
        'export { D } from "./d";',
      ].join("\n"),
      "src/widgets/a.ts": "export const A = 1;\n",
      "src/widgets/b.ts": "export const B = 1;\n",
      "src/widgets/c.ts": "export const C = 1;\n",
      "src/widgets/d.ts": "export const D = 1;\n",
      "src/widgets/e.ts": "export const E = 1;\n",
    });
    const filename = path.join(root, "src", "widgets", "index.ts");
    const linter = new Linter({ cwd: root });
    const messages = linter.verify(
      fs.readFileSync(filename, "utf8"),
      [
        {
          files: ["**/*.ts"],
          languageOptions: {
            parser: tsParser as Linter.Parser,
            parserOptions: { ecmaVersion: 2022, sourceType: "module" },
          },
          plugins: { "agent-code-guard": plugin },
          rules: {
            "agent-code-guard/no-inventory-barrel": ["error", { projectRoot: root }],
          },
        },
      ],
      { filename },
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.ruleId).toBe("agent-code-guard/no-inventory-barrel");
    expect(messages[0]?.message).toContain("This exports inventory");
  });

  it("topology preset exposes individual topology rules", () => {
    expect(plugin.configs.topology.rules).toMatchObject({
      "agent-code-guard/no-inventory-barrel": "warn",
      "agent-code-guard/no-public-vendor-type-leak": "warn",
      "agent-code-guard/no-folder-cycle": "warn",
      "agent-code-guard/require-curated-public-facade": "warn",
    });
    expect(plugin.configs.topology.rules).not.toHaveProperty(
      "agent-code-guard/topology-boundaries",
    );
  });

  it("infers the nearest package root when projectRoot is omitted", () => {
    const root = makeProject({
      "src/widgets/index.ts": [
        'export { A } from "./a";',
        'export { B } from "./b";',
        'export { C } from "./c";',
        'export { D } from "./d";',
      ].join("\n"),
      "src/widgets/a.ts": "export const A = 1;\n",
      "src/widgets/b.ts": "export const B = 1;\n",
      "src/widgets/c.ts": "export const C = 1;\n",
      "src/widgets/d.ts": "export const D = 1;\n",
      "src/widgets/e.ts": "export const E = 1;\n",
    });
    const filename = path.join("src", "widgets", "index.ts");
    const linter = new Linter({ cwd: root });
    const messages = linter.verify(
      fs.readFileSync(path.join(root, filename), "utf8"),
      [
        {
          files: ["**/*.ts"],
          languageOptions: {
            parser: tsParser as Linter.Parser,
            parserOptions: { ecmaVersion: 2022, sourceType: "module" },
          },
          plugins: { "agent-code-guard": plugin },
          rules: {
            "agent-code-guard/topology-boundaries": "error",
          },
        },
      ],
      { filename },
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.message).toContain("This exports inventory");
  });
});
