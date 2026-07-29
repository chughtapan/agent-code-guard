#!/usr/bin/env node

/**
 * @file `agent-code-guard-init` CLI entry. Emits the recommended
 * eslint.config.js snippet for the syntax rule set.
 */

const RECOMMENDED_CONFIG_SNIPPET = `
// agent-code-guard recommended setup.

import { plugin as guard } from "eslint-plugin-agent-code-guard";

export default [
  {
    files: ["src/**/*.ts"],
    ...guard.configs.recommended,
  },
];
`;

const NEXT_STEPS = `
Next:
  1. Paste the snippet into your project's \`eslint.config.js\` (or merge
     into an existing config).
  2. Make sure the project has a strict \`tsconfig.json\` and its default
     lint script runs \`tsc\`, ESLint, and Knip.
  3. Run your package lint script.
`;

function main(): void {
  process.stdout.write(RECOMMENDED_CONFIG_SNIPPET.trimStart());
  process.stdout.write(NEXT_STEPS);
}

main();
