import type { TSESTree } from "@typescript-eslint/utils";

export type ManualAlgebraRuleName =
  | "manual-result"
  | "manual-option"
  | "manual-brand";

export type ManualAlgebraReplacementTarget =
  | "Effect.Either"
  | "Effect.Option"
  | "Effect Brand.nominal"
  | "documented-local-helper"
  | "none-endorsed-yet";

export type ManualAlgebraDetectionReason =
  | "canonical-constructor-name"
  | "semantic-alias-name"
  | "guard-helper"
  | "match-helper"
  | "map-helper"
  | "flat-map-helper"
  | "brand-marker"
  | "brand-constructor";

export interface ManualAlgebraRuleOptions {
  readonly allowTypeNames?: readonly string[];
  readonly allowNamespaces?: readonly string[];
}

export interface ManualAlgebraRecommendedLevels {
  readonly "manual-result": "warn" | "error";
  readonly "manual-option": "warn" | "error";
  readonly "manual-brand": "warn";
}

export interface ManualAlgebraEvidence {
  readonly node: TSESTree.Node;
  readonly displayName: string | null;
  readonly reasons: readonly ManualAlgebraDetectionReason[];
}

export interface ManualAlgebraMatch extends ManualAlgebraEvidence {
  readonly outcome: "manual-algebra-match";
  readonly ruleName: ManualAlgebraRuleName;
  readonly replacementTarget: ManualAlgebraReplacementTarget;
  readonly carvedOutAsTransport: false;
}

export interface ManualAlgebraCarveOut extends ManualAlgebraEvidence {
  readonly outcome: "transport-carve-out";
  readonly ruleName: ManualAlgebraRuleName;
  readonly carvedOutAsTransport: true;
}

export interface ManualAlgebraMiss {
  readonly outcome: "no-match";
  readonly ruleName: ManualAlgebraRuleName;
  readonly carvedOutAsTransport: false;
}

export type ManualAlgebraDetection =
  | ManualAlgebraMatch
  | ManualAlgebraCarveOut
  | ManualAlgebraMiss;

export function manualAlgebraRecommendedLevels(): ManualAlgebraRecommendedLevels {
  throw new Error("not implemented");
}
