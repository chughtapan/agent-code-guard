#!/usr/bin/env node

/**
 * @file `agent-code-guard-init` CLI entry. Emits the recommended
 * eslint.config.js snippet for the syntax rule set.
 */

const RECOMMENDED_CONFIG_SNIPPET = `
// agent-code-guard recommended setup.

import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    },
    plugins: guard.configs.recommended.plugins,
    settings: guard.configs.recommended.settings,
    rules: guard.configs.recommended.rules,
  },
];
`;

const NEXT_STEPS = `
Next:
  1. Paste the snippet into your project's \`eslint.config.js\` (or merge
     into an existing config).
  2. Run your usual lint: \`eslint .\` or your package script.
`;

function main(): void {
  process.stdout.write(RECOMMENDED_CONFIG_SNIPPET.trimStart());
  process.stdout.write(NEXT_STEPS);
}

main();
