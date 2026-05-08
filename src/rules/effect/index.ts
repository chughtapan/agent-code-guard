import { discriminantsRules } from "./discriminants/index.js";
import { errorRules } from "./error/index.js";
import { observabilityRules } from "./observability/index.js";
import { runtimeRules } from "./runtime/index.js";
import { schemaRules } from "./schema/index.js";
import { scopeRules } from "./scope/index.js";

export const effectRules = {
  ...discriminantsRules,
  ...errorRules,
  ...observabilityRules,
  ...runtimeRules,
  ...schemaRules,
  ...scopeRules,
} as const;
