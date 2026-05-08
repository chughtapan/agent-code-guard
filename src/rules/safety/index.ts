import asUnknownAs from "./as-unknown-as.js";
import noEnvNonnullAssert from "./no-env-nonnull-assert.js";
import noProcessEnvAtRuntime from "./no-process-env-at-runtime.js";
import noRawSql from "./no-raw-sql.js";
import noRawThrowNewError from "./no-raw-throw-new-error.js";
import recordCast from "./record-cast.js";

export const safetyRules = {
  "as-unknown-as": asUnknownAs,
  "no-env-nonnull-assert": noEnvNonnullAssert,
  "no-process-env-at-runtime": noProcessEnvAtRuntime,
  "record-cast": recordCast,
  "no-raw-sql": noRawSql,
  "no-raw-throw-new-error": noRawThrowNewError,
} as const;
