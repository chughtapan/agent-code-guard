import type { TSESTree } from "@typescript-eslint/utils";
import { AST_NODE_TYPES } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

// Matches `jest.config.ts`, `vitest.config.unit.ts`, `jest.config.integration.cjs`,
// plus `package.json`. Users can lint package.json if they wire a JSON parser
// (e.g. `jsonc-eslint-parser`); the default JS parser will skip it silently.
const CONFIG_FILE_PATTERN =
  /(?:^|[\\/])(?:(?:jest|vitest|vite)\.config(?:\.[a-z0-9-]+)?\.(?:js|ts|mjs|cjs|mts|cts)|package\.json)$/i;

function isConfigFile(filename: string): boolean {
  return CONFIG_FILE_PATTERN.test(filename);
}

function keyName(
  key: TSESTree.Expression | TSESTree.PrivateIdentifier,
): string | null {
  if (key.type === AST_NODE_TYPES.Identifier) return key.name;
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === "string") {
    return key.value;
  }
  return null;
}

function parentCoverageKey(node: TSESTree.Property): boolean {
  const obj = node.parent;
  if (!obj || obj.type !== AST_NODE_TYPES.ObjectExpression) return false;
  const prop = obj.parent;
  if (!prop || prop.type !== AST_NODE_TYPES.Property || prop.computed) return false;
  return keyName(prop.key) === "coverage";
}

export default createRule({
  name: "no-coverage-threshold-gate",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flag coverage threshold gates in jest/vitest/vite configs. Coverage is diagnostic, not a merge gate.",
    },
    messages: {
      coverageGate:
        "Coverage is a diagnostic, not a merge gate. Remove `{{key}}` — threshold gates invite trivial tests that move the number without testing behavior. See docs/rules/no-coverage-threshold-gate.md.",
    },
    schema: [],
    fixable: undefined,
    hasSuggestions: false,
  },
  defaultOptions: [],
  create(context) {
    if (!isConfigFile(context.filename)) return {};
    return {
      Property(node) {
        if (node.computed) return;
        const name = keyName(node.key);
        if (!name) return;
        if (name === "coverageThreshold") {
          context.report({ node, messageId: "coverageGate", data: { key: name } });
          return;
        }
        if (name === "thresholds" || name === "threshold") {
          if (parentCoverageKey(node)) {
            context.report({ node, messageId: "coverageGate", data: { key: name } });
          }
        }
      },
    };
  },
});
