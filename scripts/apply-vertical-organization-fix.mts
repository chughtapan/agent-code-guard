import { execFileSync } from "node:child_process";
import { ESLint } from "eslint";

const shellRule = "agent-code-guard/require-stable-file-shell";
const perfectionistRulePrefix = "perfectionist/";
const trackedFiles = execFileSync("git", ["ls-files", "--", "*.ts", "*.tsx", "*.mts", "*.cts"], {
  encoding: "utf8",
}).split("\n").filter(Boolean);

const eslint = new ESLint({ cwd: process.cwd() });
const results = await eslint.lintFiles(trackedFiles);
const shellMessages = results.flatMap((result) =>
  result.messages.filter((message) => message.ruleId === shellRule),
);

if (shellMessages.length > 0) {
  process.stderr.write(`${shellRule} must be clean before Perfectionist fixes run.\n`);
  process.exitCode = 1;
} else {
  const fixer = new ESLint({
    cwd: process.cwd(),
    fix: true,
    ruleFilter: ({ ruleId }) => ruleId.startsWith(perfectionistRulePrefix),
  });
  const fixedResults = await fixer.lintFiles(trackedFiles);
  await ESLint.outputFixes(fixedResults);
}
