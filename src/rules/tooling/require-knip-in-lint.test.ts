import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import rule from "./require-knip-in-lint.js";

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  },
});

const packageJsonFixture = (body: unknown): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-code-guard-knip-"));
  const filePath = path.join(dir, "package.json");
  fs.writeFileSync(filePath, JSON.stringify(body, null, 2));
  return filePath;
};

ruleTester.run("require-knip-in-lint", rule, {
  valid: [
    {
      code: "export const value = 1;",
      options: [
        {
          packageJsonPath: packageJsonFixture({
            scripts: { lint: "eslint . && knip" },
          }),
        },
      ],
    },
    {
      code: "export const value = 1;",
      options: [
        {
          packageJsonPath: packageJsonFixture({
            scripts: { lint: "eslint . && agent-code-guard-knip" },
          }),
        },
      ],
    },
    {
      code: "export const value = 1;",
      options: [
        {
          packageJsonPath: packageJsonFixture({
            scripts: { check: "eslint . && knip" },
          }),
          scriptNames: ["check"],
        },
      ],
    },
  ],
  invalid: [
    {
      code: "export const value = 1;",
      options: [
        {
          packageJsonPath: packageJsonFixture({
            scripts: { lint: "eslint ." },
          }),
        },
      ],
      errors: [{ messageId: "missingKnip" }],
    },
    {
      code: "export const value = 1;",
      options: [
        {
          packageJsonPath: packageJsonFixture({
            scripts: { test: "vitest run" },
          }),
        },
      ],
      errors: [{ messageId: "missingScript" }],
    },
  ],
});
