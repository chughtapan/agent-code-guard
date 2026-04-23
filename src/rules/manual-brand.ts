import type { TSESLint } from "@typescript-eslint/utils";
import type { ManualAlgebraRuleOptions } from "../manual-algebra/contracts.js";

export type ManualBrandMessageIds = "manualBrand";
export type ManualBrandOptions = [ManualAlgebraRuleOptions?];

export default function manualBrandRule(): TSESLint.RuleModule<
  ManualBrandMessageIds,
  ManualBrandOptions
> {
  throw new Error("not implemented");
}
