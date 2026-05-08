import effectErrorErasure from "./effect-error-erasure.js";
import effectPromise from "./effect-promise.js";
import noEffectErrorCoalescing from "./no-effect-error-coalescing.js";

export const errorRules = {
  "effect-error-erasure": effectErrorErasure,
  "effect-promise": effectPromise,
  "no-effect-error-coalescing": noEffectErrorCoalescing,
} as const;
