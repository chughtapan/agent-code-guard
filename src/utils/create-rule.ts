import { ESLintUtils } from "@typescript-eslint/utils";

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/placeholder-org/sloppy-code-guard/blob/main/docs/rules/${name}.md`,
);
