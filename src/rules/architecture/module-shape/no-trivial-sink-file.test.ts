import * as fc from "fast-check";
import { afterEach, expect, it } from "vitest";
import {
  cleanupArchitectureFixtures,
  diagnosticsByRule,
  makeProject,
} from "../test-support/analyzer-fixtures.js";

afterEach(cleanupArchitectureFixtures);

it("Property: a leaf with multiple consumers never fires no-trivial-sink-file", () => {
  fc.assert(
    fc.property(fc.integer({ min: 2, max: 6 }), (consumerCount) => {
      const files: Record<string, string> = {
        "src/feature/leaf.ts": "export const VALUE = 1;\n",
      };
      for (let i = 0; i < consumerCount; i += 1) {
        files[`src/feature/consumer-${i}.ts`] =
          `import { VALUE } from "./leaf.js";\nexport const c${i} = VALUE;\n`;
      }
      const root = makeProject(files);
      const diagnostics = diagnosticsByRule(root, "no-trivial-sink-file");
      expect(diagnostics).toHaveLength(0);
    }),
    { numRuns: 5 },
  );
});

it("flags a small single-export file with exactly one consumer", () => {
  const root = makeProject({
    "src/feature/sink.ts": "export const VALUE = 42;\n",
    "src/feature/use.ts":
      'import { VALUE } from "./sink.js";\nexport const result = VALUE + 1;\n',
  });
  const diagnostics = diagnosticsByRule(root, "no-trivial-sink-file");
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]?.message).toContain("sink.ts");
  expect(diagnostics[0]?.message).toContain("1 consumer");
  expect(diagnostics[0]?.message).toContain("Inline its contents");
});

it("does not fire when surface is large", () => {
  const root = makeProject({
    "src/feature/large.ts":
      "export const A = 1;\nexport const B = 2;\nexport const C = 3;\nexport const D = 4;\n",
    "src/feature/use.ts":
      'import { A, B, C, D } from "./large.js";\nexport const r = A + B + C + D;\n',
  });
  const diagnostics = diagnosticsByRule(root, "no-trivial-sink-file");
  expect(diagnostics).toHaveLength(0);
});

it("does not fire when there are multiple consumers", () => {
  const root = makeProject({
    "src/feature/leaf.ts": "export const VALUE = 42;\n",
    "src/feature/a.ts":
      'import { VALUE } from "./leaf.js";\nexport const a = VALUE;\n',
    "src/feature/b.ts":
      'import { VALUE } from "./leaf.js";\nexport const b = VALUE;\n',
  });
  const diagnostics = diagnosticsByRule(root, "no-trivial-sink-file");
  expect(diagnostics).toHaveLength(0);
});

it("does not fire when the file is a pure barrel", () => {
  const root = makeProject({
    "src/feature/inner.ts": "export const X = 1;\n",
    "src/feature/barrel.ts": 'export { X } from "./inner.js";\n',
    "src/feature/use.ts":
      'import { X } from "./barrel.js";\nexport const r = X;\n',
  });
  const diagnostics = diagnosticsByRule(root, "no-trivial-sink-file");
  expect(diagnostics).toHaveLength(0);
});

it("does not fire when the sole consumer pure-re-exports the symbol (barrel exception)", () => {
  const root = makeProject({
    "src/types/user.ts": "export interface User { readonly id: string; }\n",
    "src/types/index.ts": 'export type { User } from "./user.js";\n',
  });
  const diagnostics = diagnosticsByRule(root, "no-trivial-sink-file");
  expect(diagnostics).toHaveLength(0);
});

it("does not fire on index files", () => {
  const root = makeProject({
    "src/feature/index.ts": "export const VALUE = 42;\n",
    "src/use.ts":
      'import { VALUE } from "./feature/index.js";\nexport const r = VALUE;\n',
  });
  const diagnostics = diagnosticsByRule(root, "no-trivial-sink-file");
  expect(diagnostics).toHaveLength(0);
});

it("does not fire on test-like files", () => {
  const root = makeProject({
    "src/feature/sink.test.ts":
      'export const FIXTURE = 1;\nimport { FIXTURE as X } from "./sink.test.js";\n',
    "src/feature/use.test.ts":
      'import { FIXTURE } from "./sink.test.js";\nconst _u = FIXTURE;\n',
  });
  const diagnostics = diagnosticsByRule(root, "no-trivial-sink-file");
  expect(diagnostics).toHaveLength(0);
});
