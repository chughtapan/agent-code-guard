import noSchemaTypeCast from "./no-schema-type-cast.js";
import parseIntoSchemaRequiresEffect from "./parse-into-schema-requires-effect.js";
import preferDecodeEffectAtBoundary from "./prefer-decode-effect-at-boundary.js";

export const schemaRules = {
  "no-schema-type-cast": noSchemaTypeCast,
  "parse-into-schema-requires-effect": parseIntoSchemaRequiresEffect,
  "prefer-decode-effect-at-boundary": preferDecodeEffectAtBoundary,
} as const;
