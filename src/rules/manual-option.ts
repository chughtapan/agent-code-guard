import type { TSESLint } from "@typescript-eslint/utils";
import type { ManualAlgebraRuleOptions } from "../manual-algebra/contracts.js";

export type ManualOptionMessageIds = "manualOption";
export type ManualOptionOptions = [ManualAlgebraRuleOptions?];

export default function manualOptionRule(): TSESLint.RuleModule<
  ManualOptionMessageIds,
  ManualOptionOptions
> {
  throw new Error("not implemented");
}
