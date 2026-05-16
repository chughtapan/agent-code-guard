# bench

Measures `eslint-plugin-agent-code-guard` lint time on synthetic and real
projects. Used to validate the layered performance changes in
`/home/tapanc/.claude/plans/come-up-with-a-squishy-crown.md`.

## Run

```bash
pnpm build                              # bench reads dist/
pnpm tsx bench/generate-fixture.ts      # writes bench/fixtures/{small,medium,large}/
pnpm bench                              # times all targets vs baseline.json
pnpm bench --only large                 # one target
pnpm bench --write-baseline             # overwrite baseline.json with this run
```

Targets:

- `small` — 50 generated files
- `medium` — 500 generated files
- `large` — 1,500 generated files
- `xlarge` — 5,000 generated files (opt-in; pre-optimization warm time is several
  minutes — generate via `pnpm bench:generate xlarge` only when needed)
- `self` — this repo's own `src/`

Each target spawns N subprocesses (default 3). Each subprocess runs ESLint
M times in-process (default 4). The first lint per subprocess is "cold";
the rest are "warm". Output shows the median cold and warm times across
all subprocesses, plus the diagnostic count and a hash of the sorted
diagnostic set (parity check).

The architecture analyzer that this bench was originally written to
measure now lives in `safer-by-default/lsp/architecture/`. The bench
here covers the syntax floor only.

## Baseline

`bench/baselines/baseline.json` is committed. `pnpm bench` diffs the
current run against it and prints the delta. Update with `--write-baseline`
after each performance change in the plan, then commit.

`bench/baselines/RESULTS.md` (added in Phase 4) shows the cumulative
impact across phases.

## Fixture parity

The diagnosticsHash field in each run is a `sha256` of the sorted
diagnostic set. Identical hashes mean the optimization did not change
what the analyzer reports. Hash drift between phases is a regression
unless explicitly justified.
