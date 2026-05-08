import acquireReleaseRequiresScope from "./acquire-release-requires-scope.js";
import finalizerRequiresScope from "./finalizer-requires-scope.js";
import forkRequiresLifecycle from "./fork-requires-lifecycle.js";
import runpromiseRequiresScoped from "./runpromise-requires-scoped.js";

export const scopeRules = {
  "acquire-release-requires-scope": acquireReleaseRequiresScope,
  "finalizer-requires-scope": finalizerRequiresScope,
  "fork-requires-lifecycle": forkRequiresLifecycle,
  "runpromise-requires-scoped": runpromiseRequiresScoped,
} as const;
