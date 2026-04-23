import type { TSESTree } from "@typescript-eslint/utils";
import type {
  ManualAlgebraDetection,
  ManualAlgebraRuleOptions,
} from "./contracts.js";

export function detectManualResultLike(
  node: TSESTree.Node,
  options: ManualAlgebraRuleOptions,
): ManualAlgebraDetection {
  throw new Error("not implemented");
}

export function detectManualOptionLike(
  node: TSESTree.Node,
  options: ManualAlgebraRuleOptions,
): ManualAlgebraDetection {
  throw new Error("not implemented");
}

export function detectManualBrandLike(
  node: TSESTree.Node,
  options: ManualAlgebraRuleOptions,
): ManualAlgebraDetection {
  throw new Error("not implemented");
}
