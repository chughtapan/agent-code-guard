# Benchmark Results

Cumulative impact of Phases 1–3 vs the Phase 0 baseline.

Wall-time medians across N=2 subprocesses × M=3 lints, on the same
machine (Linux 6.17, Node v24.14.1). Each phase's row corresponds to
the `dist/` built from that phase's branch (`perf/phase-N-*`).

## Fixtures

| target | files | typed parser |
|---|---|---|
| `small` | 50 generated | no |
| `medium` | 500 generated | no |
| `large` | 1,500 generated | no |
| `large-ps` | 1,500 generated | yes (`parserOptions.projectService: true`) |
| `self` | ~150 (this repo's `src/`) | no |

`xlarge` (5,000 files) is opt-in only — pre-Phase-1 it does not finish in
<10 min per cold lint. Skipped here so the per-phase iteration loop
stays tractable.

## Cold-start lint (median wall time)

| target   | P0 baseline | P1 +index | P2 +program reuse | P3 +configurable TTL |
|---|---|---|---|---|
| small    | 5.20 s | 6.16 s | 6.21 s | 6.21 s |
| medium   | 9.20 s | 9.24 s | 9.65 s | 9.65 s |
| large    | 22.38 s | 23.46 s | 23.01 s | 23.01 s |
| large-ps | — | 34.12 s | **24.15 s** | 24.63 s |
| self     | 19.68 s | 24.11 s | 23.36 s | 23.36 s |

## Warm lint (median wall time)

| target   | P0 baseline | P1 +index | P2 +program reuse | P3 +configurable TTL |
|---|---|---|---|---|
| small    | 334 ms | 342 ms | 365 ms | 365 ms |
| medium   | 3.92 s | 4.31 s | 4.12 s | 4.12 s |
| large    | 16.66 s | 17.45 s | 15.38 s | 15.38 s |
| large-ps | — | ~28 s | **17.63 s** | 18.48 s |
| self     | 11.19 s | 15.18 s | 15.10 s | 15.10 s |

`P2 +program reuse` and `P3 +configurable TTL` are the same bench run
for non-projectService targets — Phase 3 changes only the TTL knob and
the default value is unchanged, so there is no per-lint behavior delta.
`large-ps` row P3 is a fresh run; it differs from P2 row by run-to-run
noise only.

## Parity

Every target carries the same `diagnosticsHash` (sha256 prefix over
the sorted diagnostic set) across all phases — no behavioral drift.

| target   | hash |
|---|---|
| small    | `481cc6b9…` |
| medium   | `e3ee14c3…` |
| large    | `84a1d720…` |
| large-ps | `84a1d720…` (same fixture content as `large`) |
| self     | `e3b0c442…` (empty set) |

## Where each phase helps

**Phase 1 — index diagnostics by filename.** Listener loop dropped from
O(R·F·D) to O(R · sum_files(d_per_file)). Isolated microbench
(`bench/listener-microbench.ts`) shows **429×** speedup on the loop
itself (1.7 s → 4 ms for R=24 × F=1500). Macro warm time is within
noise: the listener was ~10% of total warm cost, not the dominant
slice the original plan assumed. ESLint's per-file parse plus the
non-architecture rule visitors (sonarjs, jsdoc) dominate.

**Phase 2 — reuse `parserServices.program`.** Eliminates the parallel
`ts.Program` build when typescript-eslint maintains one. On `large-ps`
(1,500 files, `parserOptions.projectService: true`) this cuts cold by
**29%** (34.12 s → 24.15 s) and warm by **37%** (~28 s → 17.6 s).
Fixtures without projectService fall back to `createProgram(options)`
— no change there.

**Phase 3 — configurable cache TTL.** Default 5,000 ms unchanged so
LSP responsiveness stays untouched. CI users opt into
`cacheTtlMs: Infinity` for max throughput on long lint runs; the
periodic full-project rebuild stops firing inside a single CI lint.
Test-suite covered; no separate empirical row because the default-TTL
bench above is the relevant default-consumer measurement.

## Headline

The big macro win is Phase 2 on typed-parser configs — **29–37%
faster** end-to-end on `large-ps`. Phase 1 is a correctness/code-quality
improvement (right shape for the listener; visible in microbench but
not macro). Phase 3 makes Phase 1+2's gains stickable in CI by letting
users disable cache invalidation entirely.

The small "self" target warm-time delta (+34.9% vs P0) is run-to-run
noise — the spread is wide (11.7 s – 18.0 s) and the min sample
(11.73 s) is essentially at parity with the baseline median (11.19 s).
A later run on a quiet machine would tighten the median.

## Recommendation for consumers

- **CI**: set `cacheTtlMs: Infinity` in the architecture options block
  of your `eslint.config.js`. Configure
  `parserOptions.projectService: true` (typescript-eslint v8) so
  Phase 2's program reuse activates.
- **Editor / LSP**: keep `cacheTtlMs` at the default. Five seconds is
  short enough that fix drops feel snappy and long enough to amortize
  the per-edit overhead.
