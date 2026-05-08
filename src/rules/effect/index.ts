import effectErrorErasure from "./effect-error-erasure.js";
import effectPromise from "./effect-promise.js";
import eitherDiscriminant from "./either-discriminant.js";
import forkRequiresLifecycle from "./fork-requires-lifecycle.js";
import handlerRequiresSpan from "./handler-requires-span.js";
import loggerConfigAtBoot from "./logger-config-at-boot.js";
import noConsoleInEffect from "./no-console-in-effect.js";
import noEffectErrorCoalescing from "./no-effect-error-coalescing.js";
import noPromiseAllInEffect from "./no-promise-all-in-effect.js";
import noSchemaTypeCast from "./no-schema-type-cast.js";
import preferAnnotateLogs from "./prefer-annotate-logs.js";
import preferDecodeEffectAtBoundary from "./prefer-decode-effect-at-boundary.js";
import preferEffectPlatform from "./prefer-effect-platform.js";
import requireSpanOnExportedEffect from "./require-span-on-exported-effect.js";
import runpromiseRequiresScoped from "./runpromise-requires-scoped.js";
import tagDiscriminant from "./tag-discriminant.js";

export const effectRules = {
  "effect-promise": effectPromise,
  "effect-error-erasure": effectErrorErasure,
  "either-discriminant": eitherDiscriminant,
  "fork-requires-lifecycle": forkRequiresLifecycle,
  "handler-requires-span": handlerRequiresSpan,
  "logger-config-at-boot": loggerConfigAtBoot,
  "no-console-in-effect": noConsoleInEffect,
  "no-effect-error-coalescing": noEffectErrorCoalescing,
  "no-promise-all-in-effect": noPromiseAllInEffect,
  "no-schema-type-cast": noSchemaTypeCast,
  "prefer-annotate-logs": preferAnnotateLogs,
  "prefer-decode-effect-at-boundary": preferDecodeEffectAtBoundary,
  "prefer-effect-platform": preferEffectPlatform,
  "require-span-on-exported-effect": requireSpanOnExportedEffect,
  "runpromise-requires-scoped": runpromiseRequiresScoped,
  "tag-discriminant": tagDiscriminant,
} as const;
