import { ESLintUtils } from "@typescript-eslint/utils";

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/placeholder-org/agent-code-guard/blob/main/docs/rules/${name}.md`,
);
