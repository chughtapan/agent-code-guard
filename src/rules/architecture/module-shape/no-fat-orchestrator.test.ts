import * as fc from "fast-check";
import { afterEach, expect, it } from "vitest";
import {
  cleanupArchitectureFixtures,
  diagnosticsByRule,
  makeProject,
} from "../test-support/analyzer-fixtures.js";

afterEach(cleanupArchitectureFixtures);

it("Property: a file with fan-out below threshold never fires no-fat-orchestrator", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 14 }), (importCount) => {
      const root = makeProject({
        ...makeImportSiblings(importCount),
        "src/feature/below-threshold.ts": makeOrchestratorBody(importCount, 25),
      });
      const diagnostics = diagnosticsByRule(root, "no-fat-orchestrator");
      expect(diagnostics).toHaveLength(0);
    }),
    { numRuns: 5 },
  );
});

function makeImportSiblings(count: number): Record<string, string> {
  const files: Record<string, string> = {};
  for (let i = 0; i < count; i += 1) {
    files[`src/feature/dep-${i}.ts`] = `export const D${i} = ${i};\n`;
  }
  return files;
}

function makeOrchestratorBody(importCount: number, statementCount: number): string {
  const imports = Array.from(
    { length: importCount },
    (_, i) => `import { D${i} } from "./dep-${i}.js";`,
  ).join("\n");
  const statements = Array.from(
    { length: statementCount },
    (_, i) => `const local${i} = ${i};`,
  ).join("\n");
  const usage = Array.from({ length: importCount }, (_, i) => `D${i}`).join(" + ");
  return `${imports}\nexport const total = ${usage};\n${statements}\n`;
}

it("flags a non-entry file with high fan-out, low fan-in, and substantive body", () => {
  const root = makeProject({
    ...makeImportSiblings(16),
    "src/feature/orchestrator.ts": makeOrchestratorBody(16, 20),
  });
  const diagnostics = diagnosticsByRule(root, "no-fat-orchestrator");
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]?.message).toContain("orchestrator.ts");
  expect(diagnostics[0]?.message).toContain("imports");
});

it("does not fire when fan-out is below threshold", () => {
  const root = makeProject({
    ...makeImportSiblings(10),
    "src/feature/small.ts": makeOrchestratorBody(10, 25),
  });
  const diagnostics = diagnosticsByRule(root, "no-fat-orchestrator");
  expect(diagnostics).toHaveLength(0);
});

it("does not fire when top-level statement count is low", () => {
  const root = makeProject({
    ...makeImportSiblings(20),
    "src/feature/wiring.ts": makeOrchestratorBody(20, 2),
  });
  const diagnostics = diagnosticsByRule(root, "no-fat-orchestrator");
  expect(diagnostics).toHaveLength(0);
});

it("does not fire when fan-in is high (it's a hub, not an orphan orchestrator)", () => {
  const root = makeProject({
    ...makeImportSiblings(16),
    "src/feature/hub.ts": makeOrchestratorBody(16, 25),
    "src/feature/use-a.ts":
      'import { total } from "./hub.js";\nexport const a = total;\n',
    "src/feature/use-b.ts":
      'import { total } from "./hub.js";\nexport const b = total;\n',
  });
  const diagnostics = diagnosticsByRule(root, "no-fat-orchestrator");
  expect(diagnostics).toHaveLength(0);
});

it("does not fire on index files", () => {
  const root = makeProject({
    ...makeImportSiblings(16),
    "src/feature/index.ts": makeOrchestratorBody(16, 20),
  });
  const diagnostics = diagnosticsByRule(root, "no-fat-orchestrator");
  expect(diagnostics).toHaveLength(0);
});

it("does not fire on files under cli/ or bin/", () => {
  const root = makeProject({
    ...makeImportSiblings(16),
    "src/cli/run.ts": makeOrchestratorBody(16, 20),
  });
  const diagnostics = diagnosticsByRule(root, "no-fat-orchestrator");
  expect(diagnostics).toHaveLength(0);
});

it("does not fire on test-like files", () => {
  const root = makeProject({
    ...makeImportSiblings(16),
    "src/feature/big.test.ts": makeOrchestratorBody(16, 20),
  });
  const diagnostics = diagnosticsByRule(root, "no-fat-orchestrator");
  expect(diagnostics).toHaveLength(0);
});
