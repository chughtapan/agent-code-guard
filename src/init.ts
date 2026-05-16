#!/usr/bin/env node

/**
 * @file `agent-code-guard-init` CLI entry. Emits the recommended
 * eslint.config.js snippet for fastest lint performance — captures the
 * Phase 2 (parserServices.program reuse) and Phase 3 (`cacheTtlMs`)
 * defaults that consumers commonly miss.
 */

const RECOMMENDED_CONFIG_SNIPPET = `
// agent-code-guard recommended setup. Captures the performance wins
// from typed-parser program reuse and disabled cache invalidation in
// CI. See https://github.com/chughtapan/agent-code-guard for context.

import guard from "eslint-plugin-agent-code-guard";
import tsParser from "@typescript-eslint/parser";

const ARCHITECTURE_OPTIONS = {
  // CI: never invalidate within a single lint run.
  // For LSP / editor use, drop this line (default 5_000 ms keeps fix
  // drops snappy under interactive editing).
  cacheTtlMs: process.env.CI ? Infinity : 5_000,
};

const ARCHITECTURE_RULE_IDS = Object.keys(guard.configs.architecture.rules);

const architectureRules = Object.fromEntries(
  ARCHITECTURE_RULE_IDS.map((id) => [
    id,
    [guard.configs.recommended.rules[id] ?? "error", ARCHITECTURE_OPTIONS],
  ]),
);

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      // projectService activates Phase 2's program reuse — the
      // analyzer shares the ts.Program typescript-eslint already
      // maintains instead of parsing every project file twice.
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: guard.configs.recommended.plugins,
    settings: guard.configs.recommended.settings,
    rules: {
      ...guard.configs.recommended.rules,
      ...architectureRules,
    },
  },
];
`;

const NEXT_STEPS = `
Next:
  1. Paste the snippet into your project's \`eslint.config.js\` (or merge
     into an existing config).
  2. Ensure \`@typescript-eslint/parser\` v8+ is installed for
     \`projectService\` support.
  3. Run your usual lint: \`eslint .\` or your package script.

Lint results land in \`node_modules/.cache/agent-code-guard/report.json\`
on first run; subsequent fresh-process lints reuse that cache when
source files are unchanged.
`;

function main(): void {
  process.stdout.write(RECOMMENDED_CONFIG_SNIPPET.trimStart());
  process.stdout.write(NEXT_STEPS);
}

main();
