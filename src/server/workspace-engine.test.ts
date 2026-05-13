import path from "node:path";
import { Duration, Effect, Either, Stream } from "effect";
import { afterEach, expect, it } from "vitest";
import { resolveArchitectureOptions } from "../rules/architecture/project/api/index.js";
import { clearArchitectureCache } from "../rules/architecture/project/cache/index.js";
import { cleanupFixtures, makeFixtureProject, writeFile } from "./test-support/fixtures.js";
import {
  WorkspaceEngineError,
  makeWorkspaceEngine,
  withWorkspaceEngine,
} from "./workspace-engine.js";

afterEach(() => {
  cleanupFixtures();
  clearArchitectureCache();
});

function makeOptions(root: string): ReturnType<typeof resolveArchitectureOptions> {
  return resolveArchitectureOptions({
    projectRoot: root,
    minExportedSiblingModules: 1,
    maxExportedSiblingRatio: 0,
    cacheTtlMs: Infinity,
  });
}

it("lintPaths returns diagnostics scoped to the requested files", () => {
  const root = makeFixtureProject();
  const indexPath = path.join(root, "src", "index.ts");

  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const engine = yield* makeWorkspaceEngine(makeOptions(root));
        const findings = yield* engine.lintPaths([indexPath]);
        expect(findings.length).toBeGreaterThan(0);
        expect(findings.every((d) => d.file === indexPath)).toBe(true);
      }),
    ),
  );
});

it("invalidations stream emits when a watched file changes on disk", { timeout: 15_000 }, () => {
  const root = makeFixtureProject();

  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const engine = yield* makeWorkspaceEngine(makeOptions(root));
        yield* engine.lintPaths([path.join(root, "src", "index.ts")]);

        const fiber = yield* Effect.fork(
          Stream.runHead(engine.invalidations).pipe(
            Effect.timeoutOption(Duration.seconds(10)),
          ),
        );

        // Give the forked fiber time to actually subscribe to the
        // PubSub before we publish. With unbounded PubSub, messages
        // emitted before a subscriber attaches are dropped.
        yield* Effect.sleep(Duration.seconds(1));
        yield* Effect.sync(() => writeFile(root, "src/m0.ts", "export const M0 = 99;\n"));

        const result = yield* fiber.await;
        if (result._tag !== "Success") {
          expect.fail(`fiber failed: ${JSON.stringify(result)}`);
        }
        expect(result.value._tag).toBe("Some");
      }),
    ),
  );
});

it("withWorkspaceEngine scopes the engine to one usage and releases on exit", () => {
  const root = makeFixtureProject();

  // Use the engine for one Effect chain. If the watcher leaked,
  // vitest's --detect-open-handles surfaces it as a failure at exit.
  return Effect.runPromise(
    withWorkspaceEngine(makeOptions(root), (engine) =>
      Effect.gen(function* () {
        const findings = yield* engine.lintPaths([path.join(root, "src", "index.ts")]);
        expect(findings.length).toBeGreaterThan(0);
      }),
    ),
  );
});

it("lintPaths surfaces WorkspaceEngineError when the analyzer call throws", () =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const root = makeFixtureProject();
        const engine = yield* makeWorkspaceEngine(makeOptions(root));
        // Force a failure by passing a programProvider that throws.
        const result = yield* engine
          .lintPaths(
            [path.join(root, "src", "index.ts")],
            () => {
              throw new Error("provider boom");
            },
            "fingerprint-test",
          )
          .pipe(Effect.either);
        Either.match(result, {
          onLeft: (err) => {
            expect(err).toBeInstanceOf(WorkspaceEngineError);
            expect(err.message).toContain("lintPaths failed");
          },
          onRight: () => expect.fail("expected Left/error"),
        });
      }),
    ),
  ));
