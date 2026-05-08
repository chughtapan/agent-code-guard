import effectForeachRequiresConcurrency from "./effect-foreach-requires-concurrency.js";
import noPromiseAllInEffect from "./no-promise-all-in-effect.js";
import preferConfigRedacted from "./prefer-config-redacted.js";
import preferEffectPlatform from "./prefer-effect-platform.js";

export const runtimeRules = {
  "effect-foreach-requires-concurrency": effectForeachRequiresConcurrency,
  "no-promise-all-in-effect": noPromiseAllInEffect,
  "prefer-config-redacted": preferConfigRedacted,
  "prefer-effect-platform": preferEffectPlatform,
} as const;
