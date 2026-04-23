import type { TSESLint } from "@typescript-eslint/utils";
import type { ManualAlgebraRuleOptions } from "../manual-algebra/contracts.js";

export type ManualResultMessageIds = "manualResult";
export type ManualResultOptions = [ManualAlgebraRuleOptions?];

export default function manualResultRule(): TSESLint.RuleModule<
  ManualResultMessageIds,
  ManualResultOptions
> {
  throw new Error("not implemented");
}
