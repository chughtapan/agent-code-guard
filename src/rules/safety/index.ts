/**
 * @file Safety rule registry. Exports the family's rule map for the
 * plugin entry; each member rule lives in a sibling file.
 */

import asUnknownAs from "./as-unknown-as.js";
import maxNonTrivialClassesPerFile from "./max-non-trivial-classes-per-file.js";
import noEnvNonnullAssert from "./no-env-nonnull-assert.js";
import noProcessEnvAtRuntime from "./no-process-env-at-runtime.js";
import noRawSql from "./no-raw-sql.js";
import noRawThrowNewError from "./no-raw-throw-new-error.js";
import recordCast from "./record-cast.js";

/**
 * Safety rule family. Catches unsafe casts, raw-SQL strings, unguarded
 * `process.env` reads, bare `throw new Error(...)`, and oversized files
 * — patterns where TypeScript otherwise loses ground at the syntax level.
 */
export const safetyRules = {
  "as-unknown-as": asUnknownAs,
  "max-non-trivial-classes-per-file": maxNonTrivialClassesPerFile,
  "no-env-nonnull-assert": noEnvNonnullAssert,
  "no-process-env-at-runtime": noProcessEnvAtRuntime,
  "record-cast": recordCast,
  "no-raw-sql": noRawSql,
  "no-raw-throw-new-error": noRawThrowNewError,
} as const;
