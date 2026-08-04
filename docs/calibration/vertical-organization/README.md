# Vertical-organization calibration

Calibration records are evidence for promoting the vertical-organization policy
from PR 1's disabled entries to PR 2's error-level entries. Inputs are read-only;
the script writes only the explicit `--out` Markdown path.

Run the command below once for each corpus. Replace placeholder paths with
absolute paths to immutable checkouts.

```sh
pnpm exec tsx scripts/calibrate-vertical-organization.mts \
  --corpus agent-code-guard \
  --root /absolute/path/to/agent-code-guard \
  --revision 19c5eb860a9508f837185b93e4ec612e9cb293ea \
  --globs "**/*.{ts,tsx,mts,cts}" \
  --exclude "node_modules/**,dist/**,coverage/**,bench/fixtures/**" \
  --out /absolute/path/to/agent-code-guard/docs/calibration/vertical-organization/agent-code-guard.md
```

The generated record includes the revision, exact command, dependency versions,
globs and excludes, per-rule findings, runtime-cycle inventory, unresolved
boundaries, reviewed partitions or suppressions, and a deterministic inspection
sample. Inspect every finding when there are at most 200; otherwise inspect the
first 200 sorted by `path:line:column:ruleId`. Classify each inspected finding
as a true positive, documented exemption, or false-positive defect.

Promotion requires no more than 5% false positives, no repeated false-positive
category, named reviewer approval, and zero unexplained Agent Code Guard
migration findings.
