/**
 * @file Effect scope sub-family registry.
 */

import acquireReleaseRequiresScope from "./acquire-release-requires-scope.js";
import finalizerRequiresScope from "./finalizer-requires-scope.js";
import forkRequiresLifecycle from "./fork-requires-lifecycle.js";
import runpromiseRequiresScoped from "./runpromise-requires-scoped.js";

/**
 * Effect scope rules. Catches `Effect.acquireRelease` and
 * `Scope.addFinalizer` placed outside a scope, `Effect.fork` calls
 * without a tied lifecycle (interrupt or join), and `Effect.runPromise`
 * calls that require a scoped runtime.
 */
export const scopeRules = {
  "acquire-release-requires-scope": acquireReleaseRequiresScope,
  "finalizer-requires-scope": finalizerRequiresScope,
  "fork-requires-lifecycle": forkRequiresLifecycle,
  "runpromise-requires-scoped": runpromiseRequiresScoped,
} as const;
