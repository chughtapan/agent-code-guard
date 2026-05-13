/**
 * @file Stdio LSP server entry. Builds a vscode-languageserver
 * `Connection`, registers handlers wired through Effect so the
 * `WorkspaceEngine` (and its `Scope`-managed watcher + cache) live
 * inside the Effect runtime. The server stays up until the parent
 * process closes stdio; the ambient `Scope` releases every workspace
 * engine on shutdown.
 *
 * V1 scope: save-time analysis. `didChange` updates the document
 * store but doesn't re-lint; `didSave` clears the cache and republishes.
 * The chokidar watcher catches out-of-band edits (git checkouts,
 * external tools) and the invalidations stream triggers a republish.
 * Live edit-in-flight diagnostics (TS LanguageService overlay) is
 * deferred to a follow-up.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, Scope, Stream } from "effect";
import {
  type Connection,
  type InitializeParams,
  type InitializeResult,
  type PublishDiagnosticsParams,
  TextDocumentSyncKind,
} from "vscode-languageserver";
import { clearWorkspaceCache } from "../rules/architecture/project/cache/index.js";
import { groupByUri } from "./diagnostic-converter.js";
import { type DocumentStore, makeDocumentStore } from "./document-store.js";
import { type WorkspaceEngine } from "./workspace-engine.js";
import { type WorkspaceRegistry, makeWorkspaceRegistry } from "./workspace-registry.js";

interface ServerDeps {
  readonly connection: Connection;
  readonly docs: DocumentStore;
  readonly registry: WorkspaceRegistry;
}

const findEngineForUri = (
  registry: WorkspaceRegistry,
  uri: string,
): Effect.Effect<WorkspaceEngine | null> =>
  Effect.gen(function* () {
    const filePath = fileURLToPath(uri);
    const roots = yield* registry.listProjectRoots();
    // Pick the longest matching project root so nested workspaces map
    // to the most specific one.
    let best: { root: string; len: number } | null = null;
    for (const root of roots) {
      if (!filePath.startsWith(root + path.sep) && filePath !== root) continue;
      if (best === null || root.length > best.len) best = { root, len: root.length };
    }
    if (best === null) return null;
    return yield* registry.findByProjectRoot(best.root);
  });

const publishForUris = (
  deps: ServerDeps,
  engine: WorkspaceEngine,
  uris: readonly string[],
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const filePaths = uris.map((uri) => fileURLToPath(uri));
    const findings = yield* engine.lintPaths(filePaths).pipe(
      Effect.catchAll(() => Effect.succeed([])),
    );
    const grouped = groupByUri(findings);
    for (const uri of uris) {
      const diagnostics = [...(grouped.get(uri) ?? [])];
      yield* Effect.sync(() => {
        const params: PublishDiagnosticsParams = { uri, diagnostics };
        deps.connection.sendDiagnostics(params);
      });
    }
  });

const publishAllOpen = (
  deps: ServerDeps,
  engine: WorkspaceEngine,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const allUris = yield* deps.docs.listUris();
    const inWorkspace: string[] = [];
    for (const uri of allUris) {
      const filePath = fileURLToPath(uri);
      if (
        filePath === engine.projectRoot ||
        filePath.startsWith(engine.projectRoot + path.sep)
      ) {
        inWorkspace.push(uri);
      }
    }
    if (inWorkspace.length > 0) yield* publishForUris(deps, engine, inWorkspace);
  });

const handleInitialize = (params: InitializeParams): InitializeResult => ({
  capabilities: {
    textDocumentSync: {
      openClose: true,
      change: TextDocumentSyncKind.Incremental,
      save: { includeText: false },
    },
    workspace: {
      workspaceFolders: {
        supported: true,
        changeNotifications: true,
      },
    },
  },
  serverInfo: { name: "agent-code-guard", version: "0.1.0" },
});

const registerInitialWorkspaces = (
  deps: ServerDeps,
  params: InitializeParams,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    const folders = params.workspaceFolders ?? [];
    for (const folder of folders) {
      const root = fileURLToPath(folder.uri);
      const engine = yield* deps.registry.register(root);
      // Re-publish for any docs in this workspace when its watcher fires.
      yield* Effect.forkScoped(
        Stream.runForEach(engine.invalidations, () => publishAllOpen(deps, engine)),
      );
    }
  });

const handleDidOpen = (
  deps: ServerDeps,
  td: { uri: string; languageId: string; version: number; text: string },
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* deps.docs.open(td);
    const engine = yield* findEngineForUri(deps.registry, td.uri);
    if (engine === null) return;
    yield* publishForUris(deps, engine, [td.uri]);
  });

const handleDidSave = (
  deps: ServerDeps,
  uri: string,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const engine = yield* findEngineForUri(deps.registry, uri);
    if (engine === null) return;
    // Force-invalidate so the next lint sees the saved content, even
    // if the watcher is slower than our handler.
    yield* Effect.sync(() => clearWorkspaceCache(engine.projectRoot));
    yield* publishAllOpen(deps, engine);
  });

const handleDidClose = (deps: ServerDeps, uri: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* deps.docs.close(uri);
    yield* Effect.sync(() => {
      deps.connection.sendDiagnostics({ uri, diagnostics: [] });
    });
  });

const setupTextHandlers = (deps: ServerDeps): void => {
  deps.connection.onInitialized(() => {
    // Initial workspace registration is wired in the Effect program
    // (see makeLspServer). Nothing to do here yet.
  });

  deps.connection.onDidOpenTextDocument((params) => {
    Effect.runFork(handleDidOpen(deps, params.textDocument));
  });

  deps.connection.onDidChangeTextDocument((params) => {
    const last = params.contentChanges.at(-1);
    if (last === undefined || !("text" in last)) return;
    // V1: update the document store but don't re-analyze on every
    // keystroke. Live overlay diagnostics is a follow-up.
    Effect.runFork(
      deps.docs.update(params.textDocument.uri, params.textDocument.version, last.text),
    );
  });

  deps.connection.onDidSaveTextDocument((params) => {
    Effect.runFork(handleDidSave(deps, params.textDocument.uri));
  });

  deps.connection.onDidCloseTextDocument((params) => {
    Effect.runFork(handleDidClose(deps, params.textDocument.uri));
  });
};

/**
 * Build the LSP server. Returns an Effect that resolves when the
 * server has bound its handlers and started listening on the supplied
 * connection. The Effect stays alive (Effect.never) so the ambient
 * `Scope` keeps every workspace engine alive until shutdown.
 * @param connection vscode-languageserver Connection (stdio in
 * production, in-memory for tests).
 * @returns Long-running Effect requiring a `Scope`.
 */
export const makeLspServer = (
  connection: Connection,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    const docs = yield* makeDocumentStore();
    const registry = yield* makeWorkspaceRegistry();
    const deps: ServerDeps = { connection, docs, registry };

    // Capture initialize params so we can register workspaces inside
    // the Effect runtime (so engines join the ambient scope).
    let initParams: InitializeParams | null = null;
    yield* Effect.sync(() => {
      connection.onInitialize((params) => {
        initParams = params;
        return handleInitialize(params);
      });
    });

    setupTextHandlers(deps);

    yield* Effect.sync(() => connection.listen());

    // Poll for initialize to arrive, then register workspaces under
    // the ambient Scope so engines release on server shutdown.
    yield* Effect.gen(function* () {
      while (initParams === null) {
        yield* Effect.sleep("50 millis");
      }
      yield* registerInitialWorkspaces(deps, initParams);
    });

    yield* Effect.never;
  }).pipe(Effect.withSpan("makeLspServer"));

