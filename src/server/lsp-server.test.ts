import path from "node:path";
import { pathToFileURL } from "node:url";
import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import {
  cleanupFixtures,
  makeFixtureProject,
} from "./test-support/fixtures.js";
import { clearArchitectureCache } from "../rules/architecture/project/cache/index.js";
import { groupByUri, toLspDiagnostic } from "./diagnostic-converter.js";
import { makeDocumentStore } from "./document-store.js";
import { makeWorkspaceRegistry } from "./workspace-registry.js";

afterEach(() => {
  cleanupFixtures();
  clearArchitectureCache();
});

it("diagnostic-converter: groups findings by URI and maps severity", () => {
  const findings = [
    {
      ruleId: "no-folder-cycle" as const,
      file: "/proj/src/a.ts",
      severity: "error" as const,
      message: "cycle",
    },
    {
      ruleId: "no-large-folder" as const,
      file: "/proj/src/a.ts",
      severity: "warn" as const,
      message: "large",
    },
    {
      ruleId: "no-folder-cycle" as const,
      file: "/proj/src/b.ts",
      severity: "error" as const,
      message: "cycle",
    },
  ];
  const grouped = groupByUri(findings);
  expect(grouped.size).toBe(2);
  const aUri = pathToFileURL("/proj/src/a.ts").toString();
  const bUri = pathToFileURL("/proj/src/b.ts").toString();
  expect(grouped.get(aUri)?.length).toBe(2);
  expect(grouped.get(bUri)?.length).toBe(1);
  const aDiagnostics = grouped.get(aUri) ?? [];
  expect(aDiagnostics[0].severity).toBe(1); // Error
  expect(aDiagnostics[1].severity).toBe(2); // Warning
  expect(aDiagnostics.every((d) => d.source === "agent-code-guard")).toBe(true);
});

it("diagnostic-converter: maps single finding to LSP diagnostic at file head", () => {
  const lsp = toLspDiagnostic({
    ruleId: "no-folder-cycle",
    file: "/proj/x.ts",
    severity: "error",
    message: "cycle detected",
  });
  expect(lsp.range.start.line).toBe(0);
  expect(lsp.range.start.character).toBe(0);
  expect(lsp.code).toBe("no-folder-cycle");
  expect(lsp.message).toBe("cycle detected");
});

it("document-store: open/update/close round-trip", () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* makeDocumentStore();
      yield* store.open({ uri: "f:///a.ts", version: 1, text: "x", languageId: "typescript" });
      const after = yield* store.get("f:///a.ts");
      expect(after?.text).toBe("x");

      yield* store.update("f:///a.ts", 2, "y");
      const updated = yield* store.get("f:///a.ts");
      expect(updated?.text).toBe("y");
      expect(updated?.version).toBe(2);

      const uris = yield* store.listUris();
      expect(uris).toEqual(["f:///a.ts"]);

      yield* store.close("f:///a.ts");
      const gone = yield* store.get("f:///a.ts");
      expect(gone).toBeNull();
    }),
  ));

it("workspace-registry: register memoizes engines per projectRoot", () => {
  const root = makeFixtureProject();
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const registry = yield* makeWorkspaceRegistry();
        const first = yield* registry.register(root);
        const second = yield* registry.register(root);
        expect(second).toBe(first);
        expect(first.projectRoot).toBe(root);

        const lookup = yield* registry.findByProjectRoot(root);
        expect(lookup).toBe(first);

        const allRoots = yield* registry.listProjectRoots();
        expect(allRoots).toEqual([root]);
      }),
    ),
  );
});

it("workspace-registry: findByProjectRoot returns null for unknown roots", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const registry = yield* makeWorkspaceRegistry();
        const lookup = yield* registry.findByProjectRoot(path.join("/non", "existent"));
        expect(lookup).toBeNull();
      }),
    ),
  ));
