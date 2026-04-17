import { ESLintUtils } from "@typescript-eslint/utils";

// Set this to your GitHub owner once the repo is published.
// Rule docs also ship inside the package at `docs/rules/<name>.md`, so agents
// with filesystem access can read them from `node_modules/eslint-plugin-agent-code-guard/docs/rules/`
// even before the URLs resolve.
const GITHUB_OWNER = "placeholder-org";
const GITHUB_REPO = "agent-code-guard";

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/main/docs/rules/${name}.md`,
);
