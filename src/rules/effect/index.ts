import effectErrorErasure from "./effect-error-erasure.js";
import effectPromise from "./effect-promise.js";
import eitherDiscriminant from "./either-discriminant.js";
import noEffectErrorCoalescing from "./no-effect-error-coalescing.js";
import { observabilityRules } from "./observability/index.js";
import { runtimeRules } from "./runtime/index.js";
import { schemaRules } from "./schema/index.js";
import { scopeRules } from "./scope/index.js";
import tagDiscriminant from "./tag-discriminant.js";

export const effectRules = {
  "effect-error-erasure": effectErrorErasure,
  "effect-promise": effectPromise,
  "either-discriminant": eitherDiscriminant,
  "no-effect-error-coalescing": noEffectErrorCoalescing,
  "tag-discriminant": tagDiscriminant,
  ...observabilityRules,
  ...runtimeRules,
  ...schemaRules,
  ...scopeRules,
} as const;
