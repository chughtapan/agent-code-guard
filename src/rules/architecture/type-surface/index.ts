/**
 * @file Type-surface analysis barrel. Re-exports the public vendor /
 * infrastructure type-leak checks and the boundary-owned type
 * requirement enforced on package exports.
 */

export {
  checkPublicVendorTypeLeaks,
  externalReExportDiagnostics,
  normalizeTypePackageName,
  packageAllowedInPublicTypes,
  packageNameFromFileName,
  packageNameFromSpecifier,
} from "./type-leaks.js";
