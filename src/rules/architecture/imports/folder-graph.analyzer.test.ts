import * as fc from "fast-check";
import { afterEach, expect, it } from "vitest";
import {
  cleanupArchitectureFixtures,
  diagnosticMessages,
  diagnosticsByRule,
  diagnosticsFor,
  hasRule,
  makeProject,
  segmentArb,
} from "../test-support/analyzer-fixtures.js";

afterEach(cleanupArchitectureFixtures);

it("flags folder cycles, root/internal cycles, and sibling domain imports", () => {
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
  });

  expect(diagnosticMessages(root)).toEqual(
    expect.arrayContaining([
      expect.stringContaining("Folder dependency cycle"),
      expect.stringContaining("Root files and internal files depend on each other"),
      expect.stringContaining("imports src/mail/send-receipt.ts across sibling domains"),
    ]),
  );
});

it("flags upward layer imports when layers are declared", () => {
  const root = makeProject({
    "src/index.ts": "export const rootValue = true;\n",
    "src/feature/use-root.ts": [
      'import { rootValue } from "../index";',
      "export const useRoot = rootValue;",
    ].join("\n"),
  });

  const messages = diagnosticMessages(root, {
    layers: [
      { name: "entrypoint", folders: ["."], reason: "test: composition root" },
      { name: "feature", folders: ["feature"], reason: "test: feature layer" },
    ],
  });
  expect(messages).toEqual(
    expect.arrayContaining([expect.stringContaining("imports upward into src/index.ts")]),
  );
  expect(messages.some((message) => message.includes("layer 'feature'"))).toBe(true);
  expect(messages.some((message) => message.includes("layer 'entrypoint'"))).toBe(true);
});

it("no-upward-layer-import is dormant when no layers are declared", () => {
  const root = makeProject({
    "src/index.ts": "export const rootValue = true;\n",
    "src/feature/use-root.ts": [
      'import { rootValue } from "../index";',
      "export const useRoot = rootValue;",
    ].join("\n"),
  });

  expect(diagnosticMessages(root).some((message) => message.includes("imports upward")))
    .toBe(false);
});

it("allows sibling domain imports through declared shared folders and test files", () => {
  const root = makeProject({
    "src/payments/charge.ts": [
      'import { sendReceipt } from "../mail/send-receipt";',
      'import { formatMoney } from "../shared/format-money";',
      "export const charge = [sendReceipt, formatMoney];",
    ].join("\n"),
    "src/payments/charge.test.ts": [
      'import { sendReceipt } from "../mail/send-receipt";',
      "export const testOnly = sendReceipt;",
    ].join("\n"),
    "src/mail/send-receipt.ts": "export const sendReceipt = true;\n",
    "src/shared/format-money.ts": "export const formatMoney = true;\n",
  });

  const diagnostics = diagnosticsByRule(root, "no-cross-domain-sibling-import", {
    sharedFolderNames: [
      { folder: "shared", reason: "test: package-wide formatting helpers" },
    ],
  });

  expect(diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
    expect.stringContaining("src/payments/charge.ts imports src/mail/send-receipt.ts"),
  ]);
});

it("does not treat re-exports or test files as upward layer imports", () => {
  const root = makeProject({
    "src/index.ts": "export const rootValue = true;\n",
    "src/feature/reexport-root.ts": 'export { rootValue } from "../index";\n',
    "src/feature/use-root.test.ts": [
      'import { rootValue } from "../index";',
      "export const useRoot = rootValue;",
    ].join("\n"),
  });

  expect(
    diagnosticsByRule(root, "no-upward-layer-import", {
      layers: [
        { name: "entrypoint", folders: ["."], reason: "test: composition root" },
        { name: "feature", folders: ["feature"], reason: "test: feature layer" },
      ],
    }),
  ).toEqual([]);
});

it("Property: folder cycles and package mesh follow generated dependency shape", () => {
  fc.assert(
    fc.property(
      fc.uniqueArray(segmentArb, { minLength: 2, maxLength: 7 }),
      fc.boolean(),
      (folders, closeCycle) => {
        const root = makeProject(folderCycleFiles(folders, closeCycle));
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

it("Property: upward edges flag and downward edges do not in layered configs", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 2 }),
      fc.integer({ min: 0, max: 2 }),
      (fromIndex, toIndex) => {
        const folders = ["app", "domain", "kernel"] as const;
        if (fromIndex === toIndex) return;
        const messages = layeredImportDiagnostics(folders, fromIndex, toIndex);
        if (fromIndex > toIndex) {
          expect(messages.length).toBeGreaterThan(0);
          expect(messages[0]?.message).toContain(`layer '${folders[fromIndex]}'`);
          expect(messages[0]?.message).toContain(`layer '${folders[toIndex]}'`);
        } else {
          expect(messages).toEqual([]);
        }
      },
    ),
    { numRuns: 18 },
  );
});

it("Property: skipping layers downward is allowed", () => {
  fc.assert(
    fc.property(fc.constant(null), () => {
      const root = makeProject({
        "src/app/index.ts": [
          'import { value } from "../kernel/index";',
          "export const reExport = value;",
        ].join("\n"),
        "src/kernel/index.ts": "export const value = true;\n",
      });
      const layers = [
        { name: "app", folders: ["app"], reason: "test: layer 0" },
        { name: "domain", folders: ["domain"], reason: "test: layer 1 (skipped)" },
        { name: "kernel", folders: ["kernel"], reason: "test: layer 2" },
      ];
      expect(diagnosticsByRule(root, "no-upward-layer-import", { layers })).toEqual([]);
    }),
    { numRuns: 5 },
  );
});

function folderCycleFiles(
  folders: readonly string[],
  closeCycle: boolean,
): Record<string, string> {
  return Object.fromEntries([
    ["src/index.ts", "export const ok = true;\n"],
    ...folders.map((folder, index) => [
      `src/${folder}/index.ts`,
      resolveFolderCycleSource(folders[index + 1] ?? (closeCycle ? folders[0] : null)),
    ] as const),
  ]);
}

function resolveFolderCycleSource(nextFolder: string | null): string {
  return nextFolder
    ? `import { value as next } from "../${nextFolder}/index"; export const value = next;\n`
    : "export const value = true;\n";
}

function layeredImportDiagnostics(
  folders: readonly ["app", "domain", "kernel"],
  fromIndex: number,
  toIndex: number,
): ReturnType<typeof diagnosticsByRule> {
  const fromFolder = folders[fromIndex] ?? "app";
  const toFolder = folders[toIndex] ?? "kernel";
  const root = makeProject({
    [`src/${fromFolder}/index.ts`]: [
      `import { value } from "../${toFolder}/index";`,
      "export const reExport = value;",
    ].join("\n"),
    [`src/${toFolder}/index.ts`]: "export const value = true;\n",
  });
  return diagnosticsByRule(root, "no-upward-layer-import", {
    layers: folders.map((folder, layerIndex) => ({
      name: folder,
      folders: [folder],
      reason: `test: layer ${layerIndex}`,
    })),
  });
}
