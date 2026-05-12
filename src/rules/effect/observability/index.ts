/**
 * @file Effect observability sub-family registry.
 */

import annotateWithoutSpan from "./annotate-without-span.js";
import handlerRequiresSpan from "./handler-requires-span.js";
import loggerConfigAtBoot from "./logger-config-at-boot.js";
import noConsoleInEffect from "./no-console-in-effect.js";
import preferAnnotateLogs from "./prefer-annotate-logs.js";
import requireSpanOnExportedEffect from "./require-span-on-exported-effect.js";

/**
 * Effect observability rules. Catches missing `Effect.withSpan` on
 * exported effects and handlers, `Effect.annotateCurrentSpan` calls
 * outside a span scope, `console.*` writes inside Effect programs,
 * `Effect.log` calls that should use `annotateLogs`, and runtime
 * `Logger.withMinimumLogLevel` configuration that belongs at boot.
 */
export const observabilityRules = {
  "annotate-without-span": annotateWithoutSpan,
  "handler-requires-span": handlerRequiresSpan,
  "logger-config-at-boot": loggerConfigAtBoot,
  "no-console-in-effect": noConsoleInEffect,
  "prefer-annotate-logs": preferAnnotateLogs,
  "require-span-on-exported-effect": requireSpanOnExportedEffect,
} as const;
