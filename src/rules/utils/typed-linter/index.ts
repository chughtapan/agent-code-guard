/**
 * @file Typed-linter utilities barrel. Exposes the parser-services
 * resolver used by rules that need a TypeScript program at lint time.
 */

/**
 * Resolves the parser services required by type-aware rules.
 */
export { requireServices } from "./services.js";
