/**
 * @file Effect rule family aggregator. Merges every sub-family rule
 * map into the single `effectRules` registry consumed by the plugin
 * entry.
 */

import { discriminantsRules } from "./discriminants/index.js";
import { errorRules } from "./error/index.js";
import { observabilityRules } from "./observability/index.js";
import { runtimeRules } from "./runtime/index.js";
import { schemaRules } from "./schema/index.js";
import { scopeRules } from "./scope/index.js";

/**
 * Effect rule family. Aggregates the per-subfamily rule maps:
 * discriminants (`_tag` / `Either` checks), error handling (`Effect.fail`,
 * coalescing, raw promises), observability (spans, log annotations),
 * runtime (fork lifecycle, scope-bound `runPromise`), schema (decode at
 * boundary, no `Schema.Type` casts), and scope/finalizer placement.
 */
export const effectRules = {
  ...discriminantsRules,
  ...errorRules,
  ...observabilityRules,
  ...runtimeRules,
  ...schemaRules,
  ...scopeRules,
} as const;
