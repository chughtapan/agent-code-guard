/**
 * @file Effect discriminants sub-family registry.
 */

import eitherDiscriminant from "./either-discriminant.js";
import tagDiscriminant from "./tag-discriminant.js";

/**
 * Effect discriminant rules. Catches manual `_tag` checks and
 * `Either.isLeft` / `Either.isRight` calls that should use the
 * `Effect.catchTag` / `Effect.match` combinators instead.
 */
export const discriminantsRules = {
  "either-discriminant": eitherDiscriminant,
  "tag-discriminant": tagDiscriminant,
} as const;
