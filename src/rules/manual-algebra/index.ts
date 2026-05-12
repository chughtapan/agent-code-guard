/**
 * @file Manual-algebra rule registry. Exports the family's rule map
 * for the plugin entry; each member rule lives in a sibling file.
 */

import manualBrand from "./manual-brand.js";
import noManualBrandConstructor from "./no-manual-brand-constructor.js";
import manualOption from "./manual-option.js";
import manualResult from "./manual-result.js";
import manualTaggedError from "./manual-tagged-error.js";
import noExportedBrandConstructor from "./no-exported-brand-constructor.js";
import noManualEnumCast from "./no-manual-enum-cast.js";

/**
 * Manual-algebra rule family. Catches hand-rolled `Result` / `Option` /
 * tagged-error / brand reimplementations that should use Effect's
 * `Either` / `Option` / `Data.TaggedError` / `Brand.nominal` instead,
 * plus string-union enum casts that should be generated unions.
 */
export const manualAlgebraRules = {
  "manual-result": manualResult,
  "manual-option": manualOption,
  "manual-brand": manualBrand,
  "no-manual-brand-constructor": noManualBrandConstructor,
  "manual-tagged-error": manualTaggedError,
  "no-exported-brand-constructor": noExportedBrandConstructor,
  "no-manual-enum-cast": noManualEnumCast,
} as const;
