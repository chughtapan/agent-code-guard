# Agent Code Guard vertical-organization calibration

Status: scaffold. Generate this evidence with
`scripts/calibrate-vertical-organization.mts` before PR 2 promotion.

## Invocation

```sh
pnpm exec tsx scripts/calibrate-vertical-organization.mts \
  --corpus agent-code-guard \
  --root /absolute/path/to/agent-code-guard \
  --revision 19c5eb860a9508f837185b93e4ec612e9cb293ea \
  --globs "**/*.{ts,tsx,mts,cts}" \
  --exclude "node_modules/**,dist/**,coverage/**,bench/fixtures/**" \
  --out /absolute/path/to/agent-code-guard/docs/calibration/vertical-organization/agent-code-guard.md
```

## Required evidence

| Field | Record |
|---|---|
| Revision | pending |
| Dependency versions | pending |
| Findings and classifications | pending |
| Runtime-cycle inventory | pending |
| Unresolved boundaries | pending |
| Reviewed partitions/suppressions | pending |
| Named reviewer approval | pending |
