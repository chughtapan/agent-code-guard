import * as fc from "fast-check";
import { Linter } from "eslint";
import { expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };
import { plugin } from "./index.js";

it("strict preset bundles SonarJS and strict complexity rules", () => {
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

it("recommended preset requires Google-style JSDoc on every top-level export", () => {
  expect(packageJson.dependencies).toHaveProperty("eslint-plugin-jsdoc");
  expect(plugin.configs.recommended.plugins).toHaveProperty("jsdoc");
  expect(plugin.configs.recommended.rules).toHaveProperty("jsdoc/check-types", "error");
  expect(plugin.configs.recommended.rules).toHaveProperty("jsdoc/no-types", "error");
  expect(plugin.configs.recommended.rules).toHaveProperty("jsdoc/no-undefined-types", "off");
  expect(plugin.configs.recommended.rules).toHaveProperty("jsdoc/require-jsdoc");
  expect(plugin.configs.recommended.rules).toHaveProperty("jsdoc/require-param", "error");
});

it("documentation preset rejects undocumented named export lists", () => {
  const linter = new Linter();
  const messages = linter.verify(
    "const value = 1;\nexport { value };",
    plugin.configs.documentation,
  );
  expect(messages).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        ruleId: "jsdoc/require-jsdoc",
      }),
    ]),
  );
});

it("documentation preset permits an empty module marker", () => {
  const linter = new Linter();
  const messages = linter.verify("export {};", plugin.configs.documentation);
  expect(messages).toEqual([]);
});

it("recommended and strict presets provide type-aware Google Style enforcement", () => {
  for (const config of [plugin.configs.recommended, plugin.configs.strict]) {
    expect(config.languageOptions?.parser).toBeDefined();
    expect(config.languageOptions?.parserOptions).toMatchObject({ projectService: true });
    expect(config.plugins).toHaveProperty("@typescript-eslint");
    expect(config.plugins).toHaveProperty("import-x");
    expect(config.plugins).toHaveProperty("@eslint-community/eslint-comments");
    expect(config.rules).toHaveProperty("@typescript-eslint/await-thenable", "error");
    expect(config.rules).toHaveProperty("@typescript-eslint/naming-convention");
    expect(config.rules).toHaveProperty("agent-code-guard/component-function-naming", "error");
    expect(config.rules).toHaveProperty("import-x/no-default-export", "error");
    expect(config.rules).toHaveProperty("@eslint-community/eslint-comments/require-description");
    expect(config.settings).toHaveProperty("import-x/extensions");
    expect(config.settings).toHaveProperty("import-x/parsers");
    expect(config.settings).toHaveProperty("import-x/resolver-next");
  }
});

it("ships the complete vertical-organization surface disabled outside documentation", () => {
  expect(packageJson.dependencies).toMatchObject({
    "comment-parser": "1.4.1",
    "eslint-plugin-jsdoc": "62.9.0",
    "eslint-plugin-perfectionist": "5.10.1",
  });
  for (const config of [plugin.configs.recommended, plugin.configs.strict]) {
    expect(config.plugins).toHaveProperty("perfectionist");
    expect(config.rules).toMatchObject({
      "agent-code-guard/no-vacuous-jsdoc": "off",
      "agent-code-guard/require-stable-file-shell": "off",
      "agent-code-guard/prefer-stepdown-function-order": "off",
      "@typescript-eslint/adjacent-overload-signatures": "off",
      "import-x/first": "off",
      "jsdoc/require-file-overview": "off",
      "perfectionist/sort-imports": ["off", expect.any(Object)],
      "perfectionist/sort-exports": ["off", expect.any(Object)],
      "perfectionist/sort-named-imports": ["off", expect.any(Object)],
      "perfectionist/sort-named-exports": ["off", expect.any(Object)],
      "perfectionist/sort-import-attributes": ["off", expect.any(Object)],
      "perfectionist/sort-export-attributes": ["off", expect.any(Object)],
      "perfectionist/sort-heritage-clauses": ["off", expect.any(Object)],
    });
  }
  expect(plugin.configs.documentation.rules).not.toHaveProperty(
    "agent-code-guard/no-vacuous-jsdoc",
  );
  expect(plugin.configs.documentation.rules).not.toHaveProperty("perfectionist/sort-imports");
});

it("does not expose the removed TypeScript quality-gate rule", () => {
  expect(plugin.rules).not.toHaveProperty("require-typescript-quality-gate");
  for (const config of [plugin.configs.recommended, plugin.configs.strict]) {
    expect(config.rules).not.toHaveProperty(
      "agent-code-guard/require-typescript-quality-gate",
    );
  }
});

it("every enabled rule in the main presets is blocking", () => {
  for (const config of [plugin.configs.recommended, plugin.configs.strict]) {
    for (const [ruleId, entry] of Object.entries(config.rules)) {
      const severity = Array.isArray(entry) ? entry[0] : entry;
      expect(
        severity === "off" || severity === 0 || severity === "error" || severity === 2,
        `${ruleId} uses non-blocking severity ${String(severity)}`,
      ).toBe(true);
    }
  }
});

it("main presets contain no formatting rules or formatter dependency", () => {
  const formattingRuleIds = [
    "indent",
    "quotes",
    "semi",
    "comma-dangle",
    "object-curly-spacing",
    "array-bracket-spacing",
    "@typescript-eslint/indent",
    "jsdoc/check-indentation",
    "jsdoc/check-line-alignment",
    "jsdoc/tag-lines",
  ];
  for (const config of [plugin.configs.recommended, plugin.configs.strict]) {
    for (const ruleId of formattingRuleIds) {
      expect(config.rules).not.toHaveProperty(ruleId);
    }
  }
  expect(packageJson.dependencies).not.toHaveProperty("oxfmt");
  expect(packageJson.devDependencies).not.toHaveProperty("oxfmt");
});

it("documentation preset enforces content requirements without formatter rules", () => {
  const config = plugin.configs.documentation;

  expect(config.plugins).toHaveProperty("jsdoc");
  expect(config.rules).toHaveProperty("jsdoc/require-param", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-param-description", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-property", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-property-description", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-returns", "error");
  expect(config.rules).toHaveProperty("jsdoc/require-description-complete-sentence", "error");
  expect(config.rules).toHaveProperty("jsdoc/match-description", "error");
  expect(config.rules).toHaveProperty("jsdoc/no-blank-blocks", "error");
  expect(config.rules).not.toHaveProperty("jsdoc/check-indentation");
  expect(config.rules).not.toHaveProperty("jsdoc/check-line-alignment");
  expect(config.rules).toHaveProperty("jsdoc/require-param-type", "off");
  expect(config.rules).toHaveProperty("jsdoc/require-returns-type", "off");

  const entry = config.rules["jsdoc/require-jsdoc"];
  expect(Array.isArray(entry)).toBe(true);
  if (!Array.isArray(entry)) {
    return;
  }
  const [severity, options] = entry;
  expect(severity).toBe("error");
  expect(options).toMatchObject({ publicOnly: { ancestorsOnly: true, esm: true } });
  if (typeof options !== "object" || options === null || !("contexts" in options)) {
    return;
  }
  const contexts = options.contexts;
  expect(Array.isArray(contexts)).toBe(true);
  if (!Array.isArray(contexts)) {
    return;
  }
  expect(
    contexts.some(
      (context) => typeof context === "string" && context.includes("ExportNamedDeclaration"),
    ),
  ).toBe(true);
  expect(contexts).toContain("ExportNamedDeclaration[declaration=null][specifiers.length>0]");
});

it("bundles Knip behind a package-owned bin", () => {
  expect(packageJson.dependencies).toHaveProperty("knip");
  expect(packageJson.bin).toMatchObject({
    "agent-code-guard-knip": "./dist/knip.js",
  });
  expect(packageJson.bin).not.toHaveProperty("knip");
});

it("Property: bundled third-party tooling has a package-owned integration surface", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(
        {
          dependency: "eslint-plugin-sonarjs",
          integration: () => plugin.configs.strict.plugins.sonarjs,
        },
        {
          dependency: "typescript-eslint",
          integration: () => plugin.configs.strict.plugins["@typescript-eslint"],
        },
        {
          dependency: "eslint-plugin-import-x",
          integration: () => plugin.configs.strict.plugins["import-x"],
        },
        {
          dependency: "eslint-import-resolver-typescript",
          integration: () => plugin.configs.strict.settings?.["import-x/resolver-next"],
        },
        {
          dependency: "@eslint-community/eslint-plugin-eslint-comments",
          integration: () => plugin.configs.strict.plugins["@eslint-community/eslint-comments"],
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
