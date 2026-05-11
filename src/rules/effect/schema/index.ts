/**
 * @file Effect schema sub-family registry.
 */

import noSchemaTypeCast from "./no-schema-type-cast.js";
import parseIntoSchemaRequiresEffect from "./parse-into-schema-requires-effect.js";
import preferDecodeEffectAtBoundary from "./prefer-decode-effect-at-boundary.js";

/**
 * Effect schema rules. Catches `Schema.decodeUnknownSync` calls that
 * should run inside an effect, `Schema.Type` / `Schema.Encoded` casts
 * at boundaries, and missing `Schema.parseEither` / `decodeUnknown`
 * usage at parser/normalizer boundaries.
 */
export const schemaRules = {
  "no-schema-type-cast": noSchemaTypeCast,
  "parse-into-schema-requires-effect": parseIntoSchemaRequiresEffect,
  "prefer-decode-effect-at-boundary": preferDecodeEffectAtBoundary,
} as const;
