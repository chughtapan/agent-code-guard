import annotateWithoutSpan from "./annotate-without-span.js";
import handlerRequiresSpan from "./handler-requires-span.js";
import loggerConfigAtBoot from "./logger-config-at-boot.js";
import noConsoleInEffect from "./no-console-in-effect.js";
import preferAnnotateLogs from "./prefer-annotate-logs.js";
import requireSpanOnExportedEffect from "./require-span-on-exported-effect.js";

export const observabilityRules = {
  "annotate-without-span": annotateWithoutSpan,
  "handler-requires-span": handlerRequiresSpan,
  "logger-config-at-boot": loggerConfigAtBoot,
  "no-console-in-effect": noConsoleInEffect,
  "prefer-annotate-logs": preferAnnotateLogs,
  "require-span-on-exported-effect": requireSpanOnExportedEffect,
} as const;
