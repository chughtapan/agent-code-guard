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

it("recommended preset bundles JSDoc content/logical rules without demanding JSDoc exists", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  expect(packageJson.dependencies).toHaveProperty("eslint-plugin-jsdoc");
  expect(plugin.configs.recommended.plugins).toHaveProperty("jsdoc");
  expect(plugin.configs.recommended.rules).toHaveProperty("jsdoc/check-types", "error");
  expect(plugin.configs.recommended.rules).toHaveProperty("jsdoc/no-undefined-types", "error");
  expect(plugin.configs.recommended.rules).not.toHaveProperty("jsdoc/require-jsdoc");
  expect(plugin.configs.recommended.rules).not.toHaveProperty("jsdoc/require-param");
});

it("documentation preset enforces full, strict JSDoc on barrel exports", () => {
  const config = plugin.configs.documentation;

  expect(config.plugins).toHaveProperty("jsdoc");
  expect(config.rules).toHaveProperty("jsdoc/require-param", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-param-description", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-property", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-property-description", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-returns", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-file-overview", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-description-complete-sentence", "error");
  expect(config.rules).toHaveProperty("jsdoc/match-description", "error");
  expect(config.rules).toHaveProperty("jsdoc/check-indentation", "error");
  expect(config.rules).toHaveProperty("jsdoc/no-blank-blocks", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-param-type", "off");
  expect(config.rules).toHaveProperty("jsdoc/require-returns-type", "off");

  const entry = config.rules["jsdoc/require-jsdoc"];
  expect(Array.isArray(entry)).toBe(true);
  if (!Array.isArray(entry)) return;
  const [severity, options] = entry;
  expect(severity).toBe("error");
  expect(options).toMatchObject({ publicOnly: { ancestorsOnly: true, esm: true } });
  const contexts = (options as { contexts: readonly string[] }).contexts;
  expect(contexts.some((c) => c.includes("ExportNamedDeclaration"))).toBe(true);
});

it("bundles Knip behind a package-owned bin", () => {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  expect(packageJson.dependencies).toHaveProperty("knip");
  expect(packageJson.bin).toMatchObject({
    "agent-code-guard-knip": "./dist/knip.js",
  });
  expect(packageJson.bin).not.toHaveProperty("knip");
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
