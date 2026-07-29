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
  expect(output).toContain("lint script runs `tsc`, `eslint .`, and Knip");
  expect(output).not.toContain('files: ["src/**/*.ts"]');
  expect(output).not.toContain("@typescript-eslint/parser");
  expect(output).not.toContain("import guard from");
});
