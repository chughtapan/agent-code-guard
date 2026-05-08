import fs from "node:fs";
import * as fc from "fast-check";
import { expect, it } from "vitest";
import plugin from "./index.js";

it("strict preset bundles SonarJS and strict complexity rules", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  expect(packageJson.dependencies).toHaveProperty("eslint-plugin-sonarjs");
  expect(plugin.configs.strict.plugins).toHaveProperty("agent-code-guard", plugin);
  expect(plugin.configs.strict.plugins).toHaveProperty("sonarjs");
  expect(plugin.configs.strict.rules).toHaveProperty("sonarjs/no-all-duplicated-branches");
  expect(plugin.configs.strict.rules).toMatchObject({
    "agent-code-guard/async-keyword": "error",
    "agent-code-guard/require-knip-in-lint": "error",
    "max-depth": ["error", 3],
    "sonarjs/cognitive-complexity": ["error", 8],
  });
});

it("bundles Knip behind a package-owned bin", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  expect(packageJson.dependencies).toHaveProperty("knip");
  expect(packageJson.bin).toMatchObject({
    knip: "./dist/knip.js",
    "agent-code-guard-knip": "./dist/knip.js",
  });
});

it("Property: bundled third-party tooling has a package-owned integration surface", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  fc.assert(
    fc.property(
      fc.constantFrom(
        {
          dependency: "eslint-plugin-sonarjs",
          integration: () => plugin.configs.strict.plugins.sonarjs,
        },
        {
          dependency: "knip",
          integration: () => packageJson.bin["agent-code-guard-knip"],
        },
      ),
      ({ dependency, integration }) => {
        expect(packageJson.dependencies).toHaveProperty(dependency);
        expect(integration()).toBeDefined();
      },
    ),
  );
});
