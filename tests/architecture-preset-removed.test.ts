/**
 * @file Regression test for the `architecture` preset boundary.
 * Asserts that a flat config which references the removed preset fails
 * loudly instead of silently loading no rules.
 */

import { describe, expect, it } from "vitest";
import plugin from "../src/index.js";

type ConfigEntry = { readonly rules: Readonly<Record<string, unknown>> };

// Runtime walker, not a typed lookup: the test must catch drift between
// `plugin.configs`'s declared keys and the object it actually exports.
function lookupConfig(key: string): ConfigEntry | undefined {
  for (const [name, value] of Object.entries(plugin.configs)) {
    if (name === key) return value;
  }
  return undefined;
}

describe("architecture preset boundary", () => {
  it("plugin.configs has no `architecture` entry", () => {
    expect(lookupConfig("architecture")).toBeUndefined();
  });

  it("a flat config that spreads the missing preset throws", () => {
    // A consumer config that does `Object.keys(guard.configs.architecture.rules)`
    // must fail to evaluate; an empty-rules silent fallback is the
    // regression this test guards against.
    const access = (): readonly string[] => {
      const archConfig = lookupConfig("architecture");
      const forced = archConfig as ConfigEntry;
      return Object.keys(forced.rules);
    };
    expect(access).toThrow(TypeError);
  });

  it("plugin.rules has no rule id from the architecture family", () => {
    const architectureRuleIds = [
      "no-folder-cycle",
      "no-root-internal-cycle",
      "no-internal-subpath-export",
      "no-public-vendor-type-leak",
      "architecture-directive-parse-error",
    ];
    for (const id of architectureRuleIds) {
      expect(plugin.rules).not.toHaveProperty(id);
    }
  });
});
