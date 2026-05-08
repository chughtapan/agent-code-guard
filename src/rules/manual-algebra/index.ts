import manualBrand from "./manual-brand.js";
import noManualBrandConstructor from "./no-manual-brand-constructor.js";
import manualOption from "./manual-option.js";
import manualResult from "./manual-result.js";
import manualTaggedError from "./manual-tagged-error.js";
import noExportedBrandConstructor from "./no-exported-brand-constructor.js";
import noManualEnumCast from "./no-manual-enum-cast.js";

export const manualAlgebraRules = {
  "manual-result": manualResult,
  "manual-option": manualOption,
  "manual-brand": manualBrand,
  "no-manual-brand-constructor": noManualBrandConstructor,
  "manual-tagged-error": manualTaggedError,
  "no-exported-brand-constructor": noExportedBrandConstructor,
  "no-manual-enum-cast": noManualEnumCast,
} as const;
