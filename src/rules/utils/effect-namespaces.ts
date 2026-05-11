/**
 * @file Shared knowledge about the `effect` package's surface. Three rules
 * key off this data: max-non-trivial-classes-per-file (factories),
 * prefer-effect-platform (pure namespaces), and tag-discriminant
 * (tagged-type names).
 */

/**
 * Effect tag-class factory call sites — `Namespace.Function` paths whose
 * call result is `extends`-able to produce a tag class.
 */
export const EFFECT_TAG_CLASS_FACTORIES: ReadonlySet<string> = new Set([
  "Data.TaggedError",
  "Data.TaggedClass",
  "Data.Class",
  "Data.Error",
  "Schema.Class",
  "Schema.TaggedClass",
  "Schema.TaggedError",
  "Schema.TaggedRequest",
  "Context.Tag",
  "Context.Reference",
  "Effect.Service",
  "Effect.Tag",
]);

/**
 * Top-level namespaces from the `effect` package that don't pull in an
 * Effect runtime — typed data, FP combinators, pattern-matching helpers.
 * Importing only these does not make a file effectful.
 *
 * `Schema` and `ParseResult` are deliberately absent: `Schema.decodeUnknown(s)(input)`
 * returns an `Effect`, so a file using them runs an Effect program.
 */
export const PURE_EFFECT_NAMESPACES: ReadonlySet<string> = new Set([
  "Array",
  "BigDecimal",
  "BigInt",
  "Boolean",
  "Brand",
  "Cause",
  "Chunk",
  "Data",
  "Duration",
  "Either",
  "Equal",
  "Equivalence",
  "Exit",
  "FastCheck",
  "Function",
  "Hash",
  "HashMap",
  "HashSet",
  "JSONSchema",
  "List",
  "Match",
  "MutableHashMap",
  "MutableHashSet",
  "MutableList",
  "MutableQueue",
  "Number",
  "Option",
  "Order",
  "Predicate",
  "Record",
  "RedBlackTree",
  "SortedMap",
  "SortedSet",
  "String",
  "Struct",
  "Tuple",
  "flow",
  "identity",
  "pipe",
]);

/**
 * Names that appear in `checker.typeToString()` output for Effect-flavored
 * tagged unions and runtime types. Used to recognize when a value's
 * TypeScript type belongs to the Effect ecosystem.
 */
const EFFECT_TAGGED_TYPE_NAMES: readonly string[] = [
  "Effect",
  "Either",
  "Option",
  "Exit",
  "Cause",
  "Fiber",
  "Stream",
  "ParseResult",
  "TaggedError",
  "TaggedClass",
  "TaggedEnum",
];

/**
 * Word-boundary regex built from `EFFECT_TAGGED_TYPE_NAMES`. Matches the
 * type-name string emitted by the TypeScript checker for Effect-flavored
 * values.
 */
export const EFFECT_TAGGED_TYPE_PATTERN: RegExp = new RegExp(
  `\\b(?:${EFFECT_TAGGED_TYPE_NAMES.join("|")})\\b`,
);
