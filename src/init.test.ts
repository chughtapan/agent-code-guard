/**
 * @file Exercises the initialization CLI as a subprocess, checking that its
 * emitted setup keeps type-aware linting and Knip in their intended lanes.
 */

import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("prints a named-export, type-aware setup", () => {
  const output = execFileSync(process.execPath, ["--import", "tsx", "src/init.ts"], {
    cwd: import.meta.dirname.replace(/\/src$/, ""),
    encoding: "utf8",
  });

  expect(output).toContain('import { plugin as guard } from "eslint-plugin-agent-code-guard";');
  expect(output).toContain('files: ["**/*.{ts,tsx,mts,cts}"]');
  expect(output).toContain("...guard.configs.recommended");
  expect(output).toContain("default lint");
  expect(output).toContain("runs ESLint over the intended source surface and Knip");
  expect(output).toContain("Keep `tsc` in the repository's explicit quality pipeline");
  expect(output).not.toContain("lint script runs `tsc`");
  expect(output).not.toContain("`eslint .`");
  expect(output).not.toContain('files: ["src/**/*.ts"]');
  expect(output).not.toContain("@typescript-eslint/parser");
  expect(output).not.toContain("import guard from");
});
