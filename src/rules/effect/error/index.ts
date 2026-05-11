/**
 * @file Effect error-handling sub-family registry.
 */

import effectErrorErasure from "./effect-error-erasure.js";
import effectPromise from "./effect-promise.js";
import noEffectErrorCoalescing from "./no-effect-error-coalescing.js";

/**
 * Effect error-handling rules. Catches generic `Error` wrapping in
 * `Effect.fail`, `Effect.promise` calls that swallow rejections as
 * defects, and `mapError` / `catchAll` shapes that collapse typed
 * error variants into one broad error.
 */
export const errorRules = {
  "effect-error-erasure": effectErrorErasure,
  "effect-promise": effectPromise,
  "no-effect-error-coalescing": noEffectErrorCoalescing,
} as const;
