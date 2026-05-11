/**
 * @file ESLint rule factory shared by every rule in the plugin. Wires
 * the standard docs-URL convention so each rule resolves to its
 * Markdown documentation page on GitHub.
 */

import { ESLintUtils } from "@typescript-eslint/utils";

// Rule docs also ship inside the package at `docs/rules/<name>.md`, so agents
// with filesystem access can read them from `node_modules/eslint-plugin-agent-code-guard/docs/rules/`
// even before the URLs resolve.
const GITHUB_OWNER = "chughtapan";
const GITHUB_REPO = "agent-code-guard";

/**
 * ESLint rule factory pre-configured with the package's docs-URL
 * convention. Every rule in the plugin is built through this factory
 * so docs links resolve consistently.
 */
export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/main/docs/rules/${name}.md`,
);
