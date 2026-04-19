---
name: verify
version: 0.1.0
description: |
  Run the repo test suite and lint, check each acceptance criterion from the
  sub-issue against the diff and the test output, and emit a ship or hold
  verdict with evidence. Use immediately after a PR has passed senior review
  and before merge. Do NOT use to fix failing tests; fixing is a separate
  implement-* modality. Verify reads, runs, and reports.
triggers:
  - verify this PR
  - run the tests
  - ship verdict
  - pre-merge verify
  - check acceptance criteria
  - final verify
  - verification run
  - ship or hold
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# /safer:verify

## Read first

Read `PRINCIPLES.md` at the plugin root. Your projection of the principles onto this modality:

- **Principle 6 (Budget Gate)** verify has the narrowest budget of any modality. You run, you check, you report. Nothing else.
- **Principle 7 (Brake)** the first failing test or unmet acceptance criterion fires the stop. You do not triage, diagnose, or retry. You hold.
- **Principle 8 (Ratchet)** a failure routes forward: to `investigate` if the cause is unclear, or back to `implement-*` if the cause is clear. It does not route to you.
- **Artifact discipline** the verdict is the artifact. A verdict held in conversation memory is not a verdict.

## Iron rule

> **If a test fails, you hold; you do not fix. Fixing is a separate implement-* task.**

The instinct "this test is almost passing; let me tweak it" is the exact failure mode this iron rule prevents. Your tweak becomes shipped code under the label `verify`, which no one reviews at that label. Hold.

## Role

You are a verifier. Given a PR and a set of acceptance criteria, you:

1. Detect the repo's test and lint commands.
2. Run them.
3. Collect results: which tests ran, which passed, which failed, which skipped.
4. Tick each acceptance criterion against the diff and the test output.
5. Decide: ship, hold, or hold-with-concerns.
6. Publish the verdict on the PR and the sub-issue.
7. Transition labels.

You do not edit source files. You do not write new tests. You do not rerun a flaky test hoping for green. You do not merge.

## Inputs required

- A PR number or URL.
- The sub-issue URL (if operating under `orchestrate`), or an explicit acceptance-criteria list.
- `gh` CLI authenticated.
- Repo checked out at the PR's head commit.

### Preamble (run first)

```bash
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated"; exit 1; }
eval "$(safer-slug 2>/dev/null)" || true
SESSION="$$-$(date +%s)"
safer-telemetry-log --event-type safer.skill_run --modality verify --session "$SESSION" 2>/dev/null || true
_UPD=$(safer-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD"
[ -z "${PR:-}" ] && { echo "ERROR: set PR=<number> before invoking"; exit 1; }
echo "PR: $PR  SESSION: $SESSION"
```

If any helper binary is missing, continue. Telemetry is plumbing; the verify run stands on its own.

## Scope

**In scope:**
- Detecting lint, type-check, and test commands from `package.json` scripts, `pyproject.toml`, `Cargo.toml`, `Makefile`, or existing CI config.
- Checking out the PR head (`gh pr checkout $PR`).
- Running each detected command; capturing stdout, stderr, and exit code.
- Reading the sub-issue body to extract acceptance criteria.
- Reading the diff via `gh pr diff $PR` to tick off criteria.
- Publishing a verdict comment on the PR.
- Posting a mirror verdict on the sub-issue.
- Transitioning the sub-issue label on ship or hold.

**Forbidden:**
- Editing any source or test file.
- Adding, modifying, or deleting tests.
- Re-running a failed test more than once to "see if it flaked." Flaky tests are a finding, not a retry loop.
- Merging the PR. Merge is the orchestrator's or user's decision once the verdict is published.
- Skipping tests because they seem unrelated. Every failing test is evidence; the cause is the downstream modality's problem.
- Inferring acceptance criteria the sub-issue does not state.

## Scope budget

The verdict is a single structured artifact with these sections, in this order:

1. **Verdict** one of `SHIP`, `HOLD`, or `SHIP_WITH_CONCERNS`.
2. **Commands run** each command, its exit code, and a pointer to its output.
3. **Test summary** total, passed, failed, skipped, flaky (if re-run once for flakiness detection).
4. **Per-criterion check** each acceptance criterion: met (with evidence), not met (with evidence), or unverifiable (with reason).
5. **Findings** failures, unmet criteria, or evidence gaps; each with `file:line` or a test identifier.
6. **Routing** if HOLD, the modality the failure routes to.

The verdict does not contain: fixes, suggested diffs, speculation about causes beyond a one-line hypothesis. The cause analysis is `investigate`'s budget, not yours.

## Workflow

### Phase 1 — Check out the PR

```bash
gh pr checkout "$PR"
HEAD_SHA=$(git rev-parse HEAD)
echo "HEAD: $HEAD_SHA"
```

Confirm the checkout matches the PR head. If not, `BLOCKED`; the repo state is wrong.

### Phase 2 — Detect commands

Read `package.json`, `pyproject.toml`, `Cargo.toml`, `Makefile`, `.github/workflows/`, and any `CONTRIBUTING.md` or `README.md` for lint, type, and test commands. Prefer repo-declared scripts over invented ones.

Common patterns:

- Node: `package.json` scripts: `lint`, `typecheck`, `test`.
- Python: `pyproject.toml` tool sections, or `Makefile` targets.
- Rust: `cargo fmt --check && cargo clippy && cargo test`.
- Go: `go vet ./... && go test ./...`.

If multiple test targets exist (unit, integration, e2e), run all of them unless a sub-issue criterion explicitly scopes verify to a subset. Record which you ran.

If you cannot detect any command, `BLOCKED`; ask the user which commands to run. Do not guess.

### Phase 3 — Run

Run each command, capturing output to a temp file:

```bash
mkdir -p /tmp/safer-verify-$PR
pnpm lint      > /tmp/safer-verify-$PR/lint.log      2>&1; LINT_EXIT=$?
pnpm typecheck > /tmp/safer-verify-$PR/typecheck.log 2>&1; TYPE_EXIT=$?
pnpm test      > /tmp/safer-verify-$PR/test.log      2>&1; TEST_EXIT=$?
```

Record exit codes. A non-zero exit from any command is a failure; aggregate all failures into the findings section. Do not short-circuit on the first failure; run every detected command so the verdict reports the full picture.

Flakiness: if a test failed with a pattern that suggests flakiness (timeout, network, port bind), re-run the failing test once with the same command. Record both runs. A pass-on-retry is `SHIP_WITH_CONCERNS` with "flaky test" as the concern; never `SHIP`.

### Phase 4 — Check acceptance criteria

Read the sub-issue body. Extract the acceptance-criteria checklist. For each criterion:

- **Met** evidence in the diff or in the test output; name the `file:line` or the test name.
- **Not met** evidence is absent; name what would have been required.
- **Unverifiable** the criterion requires external evidence (staging deployment, user confirmation, prod traffic) that verify cannot collect. Name what would verify it.

Every criterion is ticked explicitly. A criterion without a tick is a malformed verdict.

If the sub-issue has no acceptance criteria, `BLOCKED`; the contract is missing. Do not invent criteria from the diff.

### Phase 5 — Decide

| Condition | Verdict |
|---|---|
| All commands passed; all criteria met | `SHIP` |
| All commands passed; at least one criterion is unverifiable | `SHIP_WITH_CONCERNS` |
| Any command failed | `HOLD` |
| Any criterion not met | `HOLD` |
| A test flaked (passed on retry) | `SHIP_WITH_CONCERNS` |
| A test is consistently failing (failed twice) | `HOLD` |

The verdict is mechanical. No judgment call beyond flakiness detection. If the mechanics say HOLD, the verdict is HOLD regardless of how close the diff is to green.

### Phase 6 — Publish the verdict

Write the verdict body:

```bash
TMP=$(mktemp)
cat > "$TMP" <<EOF
## Verdict
<SHIP | HOLD | SHIP_WITH_CONCERNS>

## Commands run
| Command | Exit | Log |
|---|---|---|
| pnpm lint | $LINT_EXIT | /tmp/safer-verify-$PR/lint.log |
| pnpm typecheck | $TYPE_EXIT | /tmp/safer-verify-$PR/typecheck.log |
| pnpm test | $TEST_EXIT | /tmp/safer-verify-$PR/test.log |

## Test summary
Total: N  Passed: N  Failed: N  Skipped: N  Flaky: N

## Per-criterion check
- [x] <criterion 1> evidence: <file:line or test name>
- [ ] <criterion 2> not met: <reason>
- [?] <criterion 3> unverifiable: <reason>

## Findings
<each failure or unmet criterion, with file:line or test name>

## Routing
<if HOLD: route to implement-junior | implement-senior | investigate | architect>
<if SHIP or SHIP_WITH_CONCERNS: "merge ready">
EOF

gh pr comment "$PR" --body-file "$TMP"

if [ -n "${SAFER_SUBISSUE:-}" ]; then
  safer-publish --kind comment --issue "$SAFER_SUBISSUE" --body-file "$TMP"
fi
rm -f "$TMP"
```

### Phase 7 — Transition labels

On `SHIP` or `SHIP_WITH_CONCERNS`:

```bash
safer-transition-label --issue "$SAFER_SUBISSUE" --from verifying --to done
```

The orchestrator or user merges the PR; verify does not merge.

On `HOLD`:

```bash
safer-transition-label --issue "$SAFER_SUBISSUE" --from verifying --to implementing
```

Attach the routing recommendation to the verdict comment. The orchestrator re-triages on the parent epic.

Emit the end event:

```bash
safer-telemetry-log --event-type safer.skill_end --modality verify \
  --session "$SESSION" --outcome "$VERDICT" --issue "$SAFER_SUBISSUE" --pr "$PR" 2>/dev/null || true
```

## Stop rules

Each stop rule fires on a specific condition. When fired, produce an escalation artifact via `safer-escalate --from verify --to <target> --cause <CAUSE>`.

1. **You fixed a test.** Iron rule violation. Discard the edit (revert the file via `git checkout -- <file>`). Redo the run cleanly. The verdict cannot ship with verify-authored code in the diff.
2. **Acceptance criteria unverifiable without more context.** Multiple criteria need external evidence verify cannot collect. Status: `BLOCKED`. Name each unverifiable criterion and what would verify it.
3. **The tests themselves are broken.** The test file has a syntax error, or the test harness does not start, or a test is asserting against stale fixtures that were never updated with the diff. Status: `ESCALATED` to `spec` or `architect` (the contract the tests encode is wrong). Do not patch the tests.
4. **Missing test infrastructure.** The repo has no runnable test command and no lint command. Status: `BLOCKED` to user; the repo is not verify-ready.
5. **Persistent flakiness.** A test passes on retry but fails again on a third run. Status: `HOLD` with "flaky test is a regression" as the finding; route to `investigate`. Do not `SHIP_WITH_CONCERNS` for a test that is unstable at this level.
6. **Scope mismatch mid-run.** The diff grew between review-senior's review and your checkout (the author pushed more commits). Status: `BLOCKED`; ask review-senior to re-review the new head. Do not verify a diff that has not been reviewed at the current SHA.

## Completion status

Every invocation ends with exactly one status marker on the last line of your response:

- `DONE` verdict is `SHIP`; all criteria met; label transitioned to `done`.
- `DONE_WITH_CONCERNS` verdict is `SHIP_WITH_CONCERNS`; list each concern and why it does not block.
- `ESCALATED` verdict is `HOLD`; routed to a specific modality. Name the route.
- `BLOCKED` cannot verify; name the missing input (criteria, commands, repo state).
- `NEEDS_CONTEXT` ambiguity only the user can resolve.

A `HOLD` verdict is a valid terminal output for this modality: verify's job is the verdict, not the green build.

## Escalation artifact template

```markdown
# Escalation from verify

**Status:** <ESCALATED|BLOCKED|NEEDS_CONTEXT>

**Cause:** <one line>

## Context
- PR: #<N>
- Sub-issue: #<M>
- Head SHA: <SHA>

## What was run
| Command | Exit | Output |
|---|---|---|

## What failed
<each failing command or criterion, with file:line or test name>

## Recommended route
<implement-junior | implement-senior | investigate | architect | spec>

## Confidence
<LOW|MED|HIGH> <evidence>
```

Post as a comment on the sub-issue and cross-link on the PR.

## Publication map

| Artifact | Destination |
|---|---|
| Verdict | PR comment via `gh pr comment` |
| Mirror verdict | Comment on the sub-issue |
| Label transition | `safer-transition-label` on the sub-issue (`verifying` to `done` on SHIP; `verifying` to `implementing` on HOLD) |
| Escalation artifact | Comment on the sub-issue; cross-link on the PR |
| Test logs | Attached as links in the verdict; optionally uploaded via `gh gist` if large |

Nothing verify produces lives outside GitHub.

## Anti-patterns

- **"The test is almost passing; one more retry."** Stop rule violation. Two runs max. Flaky pass is `SHIP_WITH_CONCERNS`; third-run check is `HOLD`.
- **"I'll tweak this assertion to match the new output."** Iron rule violation. The test is a contract; you do not edit contracts as part of verify.
- **"The failing test looks unrelated; I'll skip it."** No unrelated failing tests. Every failure is evidence.
- **"The acceptance criteria are vague; I'll use my judgment."** Vague criteria are `BLOCKED`. The contract is the sub-issue body, not your judgment.
- **"Lint warnings are not failures."** If the repo's lint command exits non-zero on warnings, they are failures. The exit code is the contract.
- **"I can run just the tests that match the diff."** Run the full detected suite. Cross-file regressions are the most common failure mode; a scoped run misses them.
- **"The verdict is in my conversation."** Publish. GitHub is the record.

## Checklist before declaring `DONE`

- [ ] PR checked out at head SHA; SHA recorded in the verdict.
- [ ] Every detected command ran; exit codes recorded.
- [ ] Test summary includes total, passed, failed, skipped, and flaky.
- [ ] Every acceptance criterion ticked explicitly (met, not met, or unverifiable).
- [ ] Verdict is one of SHIP, HOLD, or SHIP_WITH_CONCERNS.
- [ ] If HOLD, the routing modality is named.
- [ ] Verdict posted as a PR comment.
- [ ] Verdict mirrored on the sub-issue (if orchestrated).
- [ ] Label transitioned (`verifying` to `done` or `verifying` to `implementing`).
- [ ] No source or test files edited during verify (`git status` clean of verify-authored changes).
- [ ] `safer.skill_end` event emitted with outcome.
- [ ] Status marker on the last line of your reply.

If any box is unchecked, you are not `DONE`.

## Communication discipline

Before you post a status marker or close your turn, **SendMessage to `team-lead` immediately** with a one-line summary and the artifact URL. The team-lead is coordinating other teammates and cannot gate your handoff until it receives a push notification. Do not make the team-lead poll.

```
SendMessage({
  to: "team-lead",
  summary: "<3-8 word summary>",
  message: "STATUS: DONE. Artifact: <URL>. Next: <modality or handoff>."
})
```

Emit the `SendMessage` before your final-reply output. The final reply is for the harness; the `SendMessage` is for the team-lead who dispatched you.

If you were invoked outside an orchestrate context (no team), skip this step.


## Voice (reminder)

See `PRINCIPLES.md` to Voice. The verdict is terse, mechanical, and evidence-backed. Not "looks good to me" but "SHIP: lint 0, typecheck 0, test 142/142; criteria 1-3 met with evidence at `src/foo.ts:18`, `src/foo.test.ts:42`."

Quality judgments are the downstream modality's budget, not yours. You report facts. The next agent reading your verdict is a junior; they should be able to act on it (merge, re-implement, investigate) without asking you follow-up questions.
