import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as fc from "fast-check";
import { analyzeProjectArchitecture } from "../index.js";
import { clearArchitectureCache } from "../project/api/index.js";
import type {
  ArchitectureDiagnostic,
  ArchitectureOptions,
} from "../project/diagnostics/index.js";

const tempRoots: string[] = [];

export const segmentArb = fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/);
export const ratioArb = fc.constantFrom(0, 0.25, 0.5, 0.6, 0.75, 1);

export function cleanupArchitectureFixtures(): void {
  clearArchitectureCache();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export function makeProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "acg-architecture-"));
  tempRoots.push(root);
  for (const [relativePath, contents] of Object.entries(projectFiles(files))) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }
  return root;
}

function projectFiles(files: Record<string, string>): Record<string, string> {
  return {
    "package.json": JSON.stringify(defaultPackageJson(), null, 2),
    "tsconfig.json": JSON.stringify(defaultTsconfig(), null, 2),
    "src/index.ts": "export interface PublicApi { readonly id: string; }\n",
    ...files,
  };
}

function defaultPackageJson(): Record<string, unknown> {
  return {
    name: "fixture",
    version: "1.0.0",
    type: "module",
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    },
  };
}

function defaultTsconfig(): Record<string, unknown> {
  return {
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
  };
}

export function diagnosticsFor(
  root: string,
  options: Omit<ArchitectureOptions, "projectRoot"> = {},
): readonly ArchitectureDiagnostic[] {
  return analyzeProjectArchitecture({ projectRoot: root, ...options }).diagnostics;
}

export function diagnosticsByRule(
  root: string,
  ruleId: ArchitectureDiagnostic["ruleId"],
  options: Omit<ArchitectureOptions, "projectRoot"> = {},
): readonly ArchitectureDiagnostic[] {
  return diagnosticsFor(root, options).filter((diagnostic) => diagnostic.ruleId === ruleId);
}

export function diagnosticMessages(
  root: string,
  options: Omit<ArchitectureOptions, "projectRoot"> = {},
): readonly string[] {
  return diagnosticsFor(root, options).map((diagnostic) => diagnostic.message);
}

export function sourceModuleFiles(
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

export function barrelExports(directory: string, exportCount: number): string {
  return Array.from(
    { length: exportCount },
    (_, index) => `export { M${index} } from "./m${index}";`,
  ).join("\n");
}

interface FolderApiFixtureInput {
  readonly apiFolder: string;
  readonly consumerFolder: string;
  readonly concreteCount: number;
  readonly consumerCount: number;
  readonly hasFacade: boolean;
}

export function folderApiFixture(input: FolderApiFixtureInput): Record<string, string> {
  return {
    ...folderApiConcreteFiles(input.apiFolder, input.concreteCount),
    ...folderApiConsumerFiles(input),
    ...(input.hasFacade ? { [`src/${input.apiFolder}/index.ts`]: "export const facade = 1;\n" } : {}),
  };
}

function folderApiConcreteFiles(
  apiFolder: string,
  concreteCount: number,
): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: concreteCount }, (_, index) => [
      `src/${apiFolder}/m${index}.ts`,
      `export const M${index} = ${index};\n`,
    ]),
  );
}

function folderApiConsumerFiles(input: FolderApiFixtureInput): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: input.consumerCount }, (_, consumerIndex) => [
      `src/${input.consumerFolder}/use${consumerIndex}.ts`,
      folderApiConsumerSource(input.apiFolder, input.concreteCount, input.hasFacade),
    ]),
  );
}

function folderApiConsumerSource(
  apiFolder: string,
  concreteCount: number,
  hasFacade: boolean,
): string {
  const names = Array.from({ length: concreteCount }, (_, index) => `M${index}`);
  const imports = names.map((name, index) =>
    `import { ${name} } from "../${apiFolder}/m${index}";`
  );
  const facadeImport = hasFacade ? [`import { facade } from "../${apiFolder}";`] : [];
  const terms = [...names, ...(hasFacade ? ["facade"] : [])].join(" + ");
  return [...imports, ...facadeImport, `export const used = ${terms};`].join("\n");
}

export function implicitBoundaryFixture(
  boundaryName: string,
  callerCount: number,
  helperCount: number,
): Record<string, string> {
  return {
    ...implicitBoundaryHelperFiles(helperCount),
    ...implicitBoundaryCallerFiles(boundaryName, callerCount),
    [`src/${boundaryName}.ts`]: implicitBoundarySource(callerCount, helperCount),
  };
}

function implicitBoundaryHelperFiles(helperCount: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: helperCount }, (_, index) => [
      `src/impl/h${index}.ts`,
      `export const h${index} = () => ${index};\n`,
    ]),
  );
}

function implicitBoundaryCallerFiles(
  boundaryName: string,
  callerCount: number,
): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: callerCount }, (_, index) => [
      `src/app/caller${index}.ts`,
      `import { run${index} } from "../${boundaryName}";\nexport const caller${index} = run${index}();\n`,
    ]),
  );
}

function implicitBoundarySource(callerCount: number, helperCount: number): string {
  const imports = Array.from(
    { length: helperCount },
    (_, index) => `import { h${index} } from "./impl/h${index}";`,
  );
  const exports = Array.from(
    { length: callerCount },
    (_, index) => `export const run${index} = () => h${index % helperCount}();`,
  );
  return [...imports, ...exports].join("\n");
}

export function sharedKernelCohesionFixture(
  exportCount: number,
  consumerCount: number,
  cohesive: boolean,
): Record<string, string> {
  const names = Array.from({ length: exportCount }, (_, index) => `s${index}`);
  return {
    "src/utils/kernel.ts": names
      .map((name, index) => `export const ${name} = ${index};`)
      .join("\n"),
    ...sharedKernelConsumerFiles(names, consumerCount, cohesive),
  };
}

function sharedKernelConsumerFiles(
  names: readonly string[],
  consumerCount: number,
  cohesive: boolean,
): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: consumerCount }, (_, consumerIndex) => [
      `src/consumers/c${consumerIndex}.ts`,
      sharedKernelConsumerSource(
        consumerIndex,
        cohesive ? names : names.filter((_, index) => index % consumerCount === consumerIndex),
      ),
    ]),
  );
}

function sharedKernelConsumerSource(
  consumerIndex: number,
  names: readonly string[],
): string {
  return [
    `import { ${names.join(", ")} } from "../utils/kernel";`,
    `export const consumer${consumerIndex} = ${names.join(" + ")};`,
  ].join("\n");
}

export function packageJsonWithExports(exportsValue: unknown): string {
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

export function packageJsonWithDependency(packageName: string): string {
  return JSON.stringify(
    {
      name: "fixture",
      version: "1.0.0",
      type: "module",
      dependencies: { [packageName]: "1.0.0" },
      exports: defaultPackageJson().exports,
    },
    null,
    2,
  );
}

export function nodeModuleTypePackage(packageName: string, typeName: string): Record<string, string> {
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

export function hasRule(
  diagnostics: readonly ArchitectureDiagnostic[],
  ruleId: ArchitectureDiagnostic["ruleId"],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.ruleId === ruleId);
}
