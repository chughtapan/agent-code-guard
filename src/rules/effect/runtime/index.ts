/**
 * @file Effect runtime sub-family registry.
 */

import effectForeachRequiresConcurrency from "./effect-foreach-requires-concurrency.js";
import noPromiseAllInEffect from "./no-promise-all-in-effect.js";
import preferConfigRedacted from "./prefer-config-redacted.js";
import preferEffectPlatform from "./prefer-effect-platform.js";

/**
 * Effect runtime rules. Catches `Effect.forEach` without an explicit
 * concurrency bound, `Promise.all` on effects (should be `Effect.all`),
 * sensitive `Config.string` reads that should use `Config.redacted`,
 * and direct `process.argv` / `process.env` access that should go
 * through `@effect/platform`.
 */
export const runtimeRules = {
  "effect-foreach-requires-concurrency": effectForeachRequiresConcurrency,
  "no-promise-all-in-effect": noPromiseAllInEffect,
  "prefer-config-redacted": preferConfigRedacted,
  "prefer-effect-platform": preferEffectPlatform,
} as const;
