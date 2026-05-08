import effectErrorErasure from "./effect-error-erasure.js";
import effectPromise from "./effect-promise.js";
import eitherDiscriminant from "./either-discriminant.js";
import noConsoleInEffect from "./no-console-in-effect.js";
import noEffectErrorCoalescing from "./no-effect-error-coalescing.js";
import tagDiscriminant from "./tag-discriminant.js";

export const effectRules = {
  "effect-promise": effectPromise,
  "effect-error-erasure": effectErrorErasure,
  "either-discriminant": eitherDiscriminant,
  "no-console-in-effect": noConsoleInEffect,
  "no-effect-error-coalescing": noEffectErrorCoalescing,
  "tag-discriminant": tagDiscriminant,
} as const;
