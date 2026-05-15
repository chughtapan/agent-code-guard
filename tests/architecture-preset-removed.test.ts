/**
 * @file Regression test for the removal of the `architecture` preset
 * from the plugin. Asserts that a flat config which references the
 * removed preset fails loudly instead of silently loading no rules.
 */

import { describe, expect, it } from "vitest";
import plugin from "../src/index.js";

type ConfigEntry = { readonly rules: Readonly<Record<string, unknown>> };

function lookupConfig(key: string): ConfigEntry | undefined {
  // Walks the runtime keys so the test stays honest if the type signature
  // and the runtime shape drift apart.
  for (const [name, value] of Object.entries(plugin.configs)) {
    if (name === key) return value;
  }
  return undefined;
}

describe("removed architecture preset", () => {
  it("plugin.configs has no `architecture` entry", () => {
    expect(lookupConfig("architecture")).toBeUndefined();
  });

  it("a flat config that spreads the removed preset throws", () => {
    // Pre-Phase-1 README pattern: `Object.keys(guard.configs.architecture.rules)`.
    // After removal, the access throws a TypeError that names the missing
    // key, so a consumer's `eslint.config.js` cannot silently load zero
    // rules — the config file itself fails to evaluate.
    const access = (): readonly string[] => {
      const archConfig = lookupConfig("architecture");
      // Force the same TypeError shape a real consumer hits.
      const forced = archConfig as ConfigEntry;
      return Object.keys(forced.rules);
    };
    expect(access).toThrow(TypeError);
  });

  it("plugin.rules has no rule id from the legacy architecture family", () => {
    const legacyArchitectureRuleIds = [
      "no-folder-cycle",
      "no-root-internal-cycle",
      "no-internal-subpath-export",
      "no-public-vendor-type-leak",
      "architecture-directive-parse-error",
    ];
    for (const id of legacyArchitectureRuleIds) {
      expect(plugin.rules).not.toHaveProperty(id);
    }
  });
});
