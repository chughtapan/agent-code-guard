---
name: stamina
version: 0.1.0
description: |
  Fan-out review adapter. Routes a high-blast-radius artifact (plan or PR)
  through multiple heterogeneous review passes and gates on consensus. Does
  not review; dispatches existing review skills (/simplify, /review,
  /review-senior, /safer:dogfood, /codex, /security-review for PRs;
  /safer:dogfood + /safer:review-senior + /codex for plans) and aggregates
  their verdicts. N is set by the blast-radius x reversibility table in
  PRINCIPLES.md > Durability. Two invocation modes: --plan <sub-issue-URL>
  and --pr <pr-URL>. Use when the caller (typically /safer:orchestrate Phase
  5c) has decided the artifact warrants stamina. Do NOT self-invoke from the
  working modality; that is Principle 5 self-polishing.
triggers:
  - stamina review this PR
  - fan out reviewers
  - multi-persona review
  - run N review passes
  - gate on consensus
  - heterogeneous review
allowed-tools:
  - Bash
  - Read
  - Agent
---

# /safer:stamina

## Read first

Read `PRINCIPLES.md` at the plugin root before invoking. Projection onto this modality:

- **Artifact discipline > Durability** — this skill is the enforcement mechanism for the Durability clause. The budget table lives there; this skill reads it. Every `N` you pick traces to a row.
- **Principle 5 (Junior Dev Rule)** — stamina routes; it does not review. Every verdict comes from a dispatched reviewer.
- **Principle 8 (Ratchet)** — any BLOCK verdict routes upstream (to the modality that authored the artifact), never sideways via a stamina-authored patch.
- **Artifact discipline > GitHub is the record** — the consolidated verdict is published to the target issue/PR; per-reviewer reports link to the reviewer's native artifact (`gh pr review`, issue comment).

Shape sibling: `skills/review-senior/SKILL.md` and `skills/dogfood/SKILL.md`. Stamina is a dispatcher over them, not a superset.

## Dispatch modes

Stamina has two invocation modes depending on whether the invoker can spawn sub-teammates. Resolve the mode before Phase 1.

- **Mode A — standalone or team-lead.** Invoker is the user, an orchestrator, or a team-lead. The `Agent` tool accepts `name` / `team_name` / `mode` parameters. Stamina fans out directly: one `Agent` call per dispatched reviewer, as documented in Phase 2 below. This is the default; all subsequent phase instructions assume it.

- **Mode B — in-team teammate.** Stamina was itself dispatched as a teammate (e.g., a team-lead ran `Agent({ name: "stamina-...", team_name: "..." })`). The harness disables `name` / `team_name` / `mode` on the `Agent` tool for non-lead teammates, so stamina cannot spawn sub-reviewers. Fan-out is impossible from inside the team. Escalate the dispatch plan back to the team-lead via `SendMessage` and stop; the team-lead spawns the reviewers and reports consensus back to the original caller.

### Detection

Do not branch on invocation metadata. Branch on observed tool behavior:

1. Resolve the dispatch set per Phase 1 as usual.
2. Attempt the first reviewer dispatch (Phase 2 shape, one `Agent` call with `team_name`).
3. If `Agent` returns a rejection containing the string `teammates cannot spawn teammates` (or the functional equivalent: any refusal tied to `name` / `team_name` / `mode` unavailability in this context), switch to Mode B immediately. Do not retry. Do not strip `team_name` and retry without it; an un-named dispatch loses the telemetry and aggregation handles stamina relies on.
4. Otherwise (the call dispatched), continue Phase 2 for the remaining reviewers.

The detection is one-shot. Once you are in Mode B for this invocation, all remaining reviewers route through the team-lead; do not re-probe per reviewer.

### Mode B — escalation to team-lead

In Mode B, stamina produces no consolidated GitHub comment and does not transition labels. Those artifacts are the team-lead's responsibility after it completes the fan-out stamina described. Stamina's deliverable in Mode B is the escalation message plus a status marker.

Send exactly one message, shape below. Copy-pasteable template:

```
SendMessage({
  to: "team-lead",
  summary: "stamina Mode B: team-lead must dispatch N reviewers",
  message: """
STATUS: ESCALATED (stamina Mode B — in-team teammate cannot spawn sub-teammates)

Target: <PR or sub-issue URL>
Mode: <plan|pr>
N: <N> (source: <table|user-override>; ceiling: <4|3 degraded>)

Dispatch plan (team-lead: spawn each via Agent + team_name, in parallel):

1. Role: <acceptance-vs-diff>
   Skill: </safer:review-senior>
   Prompt: |
     <verbatim Phase-2 prompt, self-contained: target URL, acceptance criteria,
      role, status-marker requirement>

2. Role: <cold-start-read>
   Skill: </safer:dogfood>
   Prompt: |
     <verbatim Phase-2 prompt>

<... one entry per reviewer, up to N ...>

Consensus rule: apply the Phase-4 aggregation table verbatim (All DONE → DONE;
All DONE/DONE_WITH_CONCERNS with ≥1 concern → DONE_WITH_CONCERNS; any
ESCALATED or CHANGES_REQUESTED → ESCALATED; any BLOCKED → BLOCKED; any
NEEDS_CONTEXT at ceiling → NEEDS_CONTEXT).

Publication: one consolidated comment on <target URL> using the Phase-5 shape.
Label transition (plan mode only): review → plan-approved on DONE.

Independence rule: reject any dispatch that repeats skill+model. Cross-model
channel is /codex.

Stamina stops here. Team-lead owns dispatch, collection, aggregation, publish.
  """
})
```

After sending, report `ESCALATED` on the last line of your reply with cause `STAMINA_MODE_B_IN_TEAM`. Do not attempt partial fan-out. Do not write the consolidated comment yourself.

## Iron rule

> **Stamina routes; it does not review.**

The failure mode this prevents: the stamina agent reading the diff "to sanity-check" the dispatched reviewers, then weighing in with its own opinion. Any reading not attributed to a dispatched reviewer is a violation of the iron rule. If stamina needs a verdict shape that no existing review skill produces, the review family is incomplete — escalate to spec, do not synthesize one inline. The consolidated comment is a routing table over the dispatched reviewers' verdicts, nothing more.

## Role

Stamina is a fan-out adapter above the review family. One invocation takes one artifact URL (PR or sub-issue) and one budget N. It classifies the artifact, selects a dispatch set of heterogeneous review skills, fans them out via the `Agent` tool, collects each reviewer's published verdict from GitHub, aggregates under the consensus rule, and publishes one consolidated verdict comment on the target. The bodies of the reviews are done by the dispatched reviewers; stamina classifies, dispatches, aggregates, publishes.

## Inputs required

- `--plan <sub-issue-URL>` or `--pr <pr-URL>` — exactly one. Both or neither is a `NEEDS_CONTEXT` stop.
- `gh` CLI authenticated.
- Blast-radius signal: `safer-diff-scope --pr <N>` output for `--pr` mode; sub-issue `safer:<modality>` label for `--plan` mode.
- Optional: `--budget <N>` to override the table-inferred N (1 ≤ N ≤ 4; N>4 requires `safer-escalate --cause USER_BUDGET_OVERRIDE`).

### Preamble (run first)

```bash
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated"; exit 1; }
eval "$(safer-slug 2>/dev/null)" || true
SESSION="$$-$(date +%s)"
_TEL_START=$(date +%s)
safer-telemetry-log --event-type safer.skill_run --modality stamina --session "$SESSION" 2>/dev/null || true
_UPD=$(safer-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "unknown/unknown")
echo "REPO: $REPO"
echo "SESSION: $SESSION"
echo "MODE: ${MODE:?set to plan|pr}"
echo "TARGET: ${TARGET_URL:?set to sub-issue or PR URL}"
```

Emit `safer.stamina_gate` at start with the chosen N, N-source (`table` | `user-override`), dispatch set, and invocation mode.

## Scope

**In scope:**
- Classifying the artifact via `safer-diff-scope` (PR mode) or sub-issue modality label (plan mode) to select N.
- Selecting the dispatch set from the fixed review family for the chosen mode.
- Dispatching each selected reviewer via the `Agent` tool with a self-contained prompt (artifact URL, acceptance criteria, request to publish a verdict comment to the artifact's thread and return its URL).
- Collecting each reviewer's published verdict from GitHub (not from agent return values).
- Aggregating verdicts under the consensus rule.
- Publishing one consolidated comment on the target issue/PR.
- Transitioning exactly one label on the target sub-issue (plan mode) or leaving the PR label alone (PR mode — `/safer:verify` runs next).

**Forbidden:**
- Reading the diff or the plan body to form a first-party opinion.
- Editing source files, the plan, or any reviewer's output.
- Running the test suite (that is `/safer:verify`'s budget).
- Dispatching a reviewer outside the fixed review family.
- Running two instances of the same reviewer skill and counting them as two passes (independence rule).
- Proceeding on partial approve when any reviewer returned BLOCK.

## Scope budget

1. One consolidated comment per invocation. Not one per reviewer — dispatched reviewers publish their own native artifacts.
2. N is bounded: floor N=1, ceiling N=4 table-default, N>4 requires explicit user approval (captured in `--budget` or `safer-escalate`).
3. Review family (PR mode): `/simplify`, `/review`, `/safer:review-senior`, `/safer:dogfood`, `/codex`, `/security-review`. Fixed list; no additions in v1.
4. Review family (plan mode): `/safer:dogfood`, `/safer:review-senior` (re-targeted at the plan body), `/codex` (cross-model). Fixed list; no additions in v1.
5. Graceful degradation: if gstack is absent, the PR dispatch set reduces to `{/safer:review-senior, /safer:dogfood}` plus `/codex` if configured; the ceiling caps at N=3. Never hard-fail on a missing optional dep; always name what is missing in the consolidated comment.
6. Persona diversity: every pass differs by *role* (acceptance-vs-diff, structural-diff, adversarial, security, simplification, cold-start-read) or by *model* (`/codex` is the cross-model channel). Two passes with the same role on the same model do not count as two passes; reject at dispatch time.

`safer-diff-scope` is the mechanical classifier for PR mode. Expected output fields: `{tier, files, modules, exports, new_deps, rationale}`. Any other output is a `NEEDS_CONTEXT` stop.

## Workflow

### Phase 1 — Classify

Compute blast radius; select N from the Durability table; select the dispatch set; record both in telemetry.

**PR mode:**

```bash
SCOPE_JSON=$(safer-diff-scope --pr "$PR_URL" --json 2>/dev/null) || { echo "scope classifier failed"; exit 1; }
TIER=$(echo "$SCOPE_JSON" | jq -r .tier)
EXPORTS=$(echo "$SCOPE_JSON" | jq -r .exports)
MODULES=$(echo "$SCOPE_JSON" | jq -r .modules)
NEW_DEPS=$(echo "$SCOPE_JSON" | jq -r .new_deps)
# Destructive detection (path-prefix + diff keyword scan; see PRINCIPLES.md Durability row 5).
DESTRUCTIVE=$(gh pr diff "$PR_URL" | grep -E '^\+.*(DROP TABLE|DELETE FROM|ALTER COLUMN .* NOT NULL|TRUNCATE)|^diff --git .*(migrations/|db/migrate)' && echo yes || echo no)
```

Map to the Durability budget table:

| `safer-diff-scope` signal | Durability row | N |
|---|---|---|
| `tier=junior`, `exports=0`, `modules<=1`, `new_deps=0` | Internal only, high-rev | 1 |
| `tier=junior`, `modules>=2`, `exports=0` | Internal cross-module | 2 |
| `tier=senior`, `exports=0` | Internal cross-module, med-rev | 2 |
| `tier=senior`, `exports>0` | Public surface | 3 |
| `tier=staff` | Public surface / user-visible | 3 |
| `tier=staff`, `new_deps>0` OR `DESTRUCTIVE=yes` | Destructive | 4 |

**Plan mode:**

```bash
LABEL=$(gh issue view "$SUB_ISSUE" --json labels -q '.labels[].name' | grep '^safer:' | head -1)
```

| sub-issue label | N |
|---|---|
| `safer:implement-junior` | 1 |
| `safer:implement-senior`, `safer:investigate`, `safer:spike`, `safer:research` | 2 |
| `safer:spec`, `safer:architect`, `safer:design-module` | 3 |
| `safer:implement-staff` | 3 |

**Dispatch set selection.** From the chosen N, select role-diverse reviewers until |set| ≥ N. Roles map to skills:

| Role | Skill (PR mode) | Skill (plan mode) |
|---|---|---|
| acceptance-vs-diff | `/safer:review-senior` | `/safer:review-senior` (plan-body target) |
| structural-diff | `/review` (gstack) | — |
| simplification | `/simplify` (gstack) | — |
| cold-start-read | `/safer:dogfood` | `/safer:dogfood` |
| adversarial, cross-model | `/codex` (optional) | `/codex` (optional) |
| security | `/security-review` (auto-skipped if no auth/crypto/secret touches per `safer-diff-scope`) | — |

Apply graceful degrade (Scope budget rule 5) if gstack or codex is absent. If the final set has fewer roles than N, cap N down to the set size and record `n-capped=true` in telemetry. If the capped N < 1 the classifier is broken → `NEEDS_CONTEXT`.

```bash
safer-telemetry-log --event-type safer.stamina_gate \
  --session "$SESSION" --modality stamina \
  --payload "{\"mode\":\"$MODE\",\"n\":$N,\"n_source\":\"$N_SOURCE\",\"dispatch_set\":$DISPATCH_JSON}"
```

### Phase 2 — Dispatch

Fan out the dispatch set via one `Agent` call per reviewer. Each agent runs in a fresh session with a self-contained prompt. No session-history leakage. Prompt shape:

```
You are running `<reviewer-skill>` as a stamina-dispatched reviewer.

Target: <artifact-URL>
Acceptance criteria: <verbatim from the sub-issue, or the PR's linked issue>
Role: <acceptance-vs-diff | structural-diff | simplification | cold-start-read | adversarial | security>

Run the skill's standard workflow. Publish your verdict to the artifact's
thread via the skill's native publication path (gh pr review for PRs, gh issue
comment for plans).

When finished, emit exactly one line:
  VERDICT_URL: <url-of-your-published-comment>
  STATUS: <DONE|DONE_WITH_CONCERNS|ESCALATED|BLOCKED|NEEDS_CONTEXT>

Do not synthesize a status you did not observe. Do not summarize another
reviewer's work. You are one voice in the dispatch set.
```

Independence check: reject launch if two entries in the dispatch set share the same skill + model. The only cross-model channel is `/codex`.

Record per-reviewer dispatch: role, skill, agent invocation id.

### Phase 3 — Collect

Read each reviewer's verdict from GitHub, not from the Agent return string. Agent return is telemetry; GitHub is the record.

```bash
# For each dispatched reviewer:
gh api "repos/$REPO/issues/$N/comments" --paginate \
  | jq --arg url "$VERDICT_URL" '.[] | select(.html_url == $url) | .body'
# Or for PR reviews:
gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
  | jq --arg url "$VERDICT_URL" '.[] | select(.html_url == $url) | .body,.state'
```

Parse the safer status marker from the body. Status vocabulary: `DONE`, `DONE_WITH_CONCERNS`, `ESCALATED`, `BLOCKED`, `NEEDS_CONTEXT`. GitHub native states (`APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`) map to:

| GitHub state | Safer tag |
|---|---|
| `APPROVED` with no concerns | `DONE` |
| `APPROVED` with concerns body | `DONE_WITH_CONCERNS` |
| `CHANGES_REQUESTED` | `ESCALATED` |
| `COMMENTED` with explicit status marker | as stated |
| no verdict within dispatch window | `BLOCKED` for that reviewer |

If a reviewer's body has no parseable marker: record `NEEDS_CONTEXT` for that reviewer; do not infer.

### Phase 4 — Aggregate under the consensus rule

The aggregate is a deterministic function of the collected per-reviewer tags. The function:

| Per-reviewer set | Aggregate |
|---|---|
| All `DONE` | `DONE` |
| All `DONE` or `DONE_WITH_CONCERNS`, at least one concern | `DONE_WITH_CONCERNS` |
| Any `ESCALATED` or GitHub `CHANGES_REQUESTED` | `ESCALATED` |
| Any `BLOCKED` (dispatch failed) | `BLOCKED` |
| Any `NEEDS_CONTEXT`, remainder approve | `NEEDS_CONTEXT` if at ceiling; otherwise widen dispatch set by one role and retry once |
| Partial approve at ceiling (split verdicts, no BLOCK, N=ceiling) | `NEEDS_CONTEXT` |

Stamina does not grade reviewers; does not downgrade a BLOCK to a concern; does not retry a reviewer whose verdict it disagrees with. Any input shape not in the table above → `NEEDS_CONTEXT` (stamina stops; user arbitrates).

### Phase 5 — Publish

One consolidated comment on the target PR or sub-issue. Shape:

```markdown
## Stamina verdict: <DONE|DONE_WITH_CONCERNS|ESCALATED|BLOCKED|NEEDS_CONTEXT>

**Mode:** <plan|pr> | **N:** <N> (source: <table|user-override>) | **Ceiling:** <4|3 degraded>

### Dispatch set

| Role | Skill | Verdict | Comment |
|---|---|---|---|
| acceptance-vs-diff | `/safer:review-senior` | DONE | <url> |
| cold-start-read | `/safer:dogfood` | DONE_WITH_CONCERNS | <url> |
| adversarial | `/codex` | DONE | <url> |

### Concerns (if any)

- [`/safer:dogfood`]: <one-line quote>, see <url>.

### Next route

- On `DONE`: label `review → plan-approved` (plan mode) / PR awaits `/safer:verify` (PR mode).
- On `ESCALATED`: `safer-escalate --from stamina --to <authoring-modality> --cause REVIEWER_BLOCK`.
- On `BLOCKED`: reviewer dispatch failed — <reviewer-name>, last-known state <state>.
- On `NEEDS_CONTEXT`: <the open question>.

### Graceful-degrade notes (if any)

- `/codex` not configured; ceiling capped to N=3.
```

Publish via `safer-publish` (one call; idempotent on retries). On plan mode `DONE`, transition the label:

```bash
safer-transition-label --issue "$SUB_ISSUE" --from review --to plan-approved
```

On PR mode `DONE`, do not transition the PR label — `/safer:verify` runs next and owns that transition.

On `ESCALATED`:

```bash
safer-escalate --from stamina --to "$AUTHORING_MOD" --cause REVIEWER_BLOCK
# Plan mode additionally:
safer-transition-label --issue "$SUB_ISSUE" --from review --to planning
```

### Phase 6 — Close out

Emit one `safer.stamina_gate` end event (outcome, N, dispatch set, consensus result) and one `safer.stamina_pass` per dispatched reviewer (role, skill, verdict, artifact URL).

```bash
for r in $DISPATCHED; do
  safer-telemetry-log --event-type safer.stamina_pass \
    --session "$SESSION" --modality stamina \
    --payload "{\"role\":\"$r_role\",\"skill\":\"$r_skill\",\"verdict\":\"$r_verdict\",\"url\":\"$r_url\"}"
done

safer-telemetry-log --event-type safer.stamina_gate \
  --session "$SESSION" --modality stamina --outcome "$OUTCOME" \
  --payload "{\"n\":$N,\"consensus\":\"$OUTCOME\",\"duration_s\":$(($(date +%s) - $_TEL_START))}"

safer-telemetry-log --event-type safer.skill_end --modality stamina \
  --session "$SESSION" --outcome "$OUTCOME" \
  --duration-s "$(($(date +%s) - $_TEL_START))" 2>/dev/null || true
```

Report the status marker on the last line of your reply.

## Stop rules

1. **Reader, not writer.** If you start forming a first-party opinion on the artifact, the iron rule fired. Dispatch or escalate; do not summarize a reading you did yourself. → `ESCALATED` to spec with cause `STAMINA_IRON_RULE_FIRED`.
2. **Homogeneous dispatch.** If the candidate dispatch set covers fewer than 2 distinct roles at N≥2, the persona-diversity rule fired — → `NEEDS_CONTEXT` to user, name the missing roles.
3. **Missing artifact.** Target PR or sub-issue URL is unresolvable → `NEEDS_CONTEXT`.
4. **No acceptance criteria.** Sub-issue has no acceptance checklist → `NEEDS_CONTEXT` to orchestrator.
5. **Reviewer dispatch failed.** Any dispatched reviewer did not publish within the invocation window → `BLOCKED` with the reviewer name and last-known state.
6. **Partial approve at ceiling.** N=ceiling, verdicts split, no movement available → `NEEDS_CONTEXT` with the disagreement summary; user arbitrates.
7. **Budget override above 4.** User asked for N>4 without explicit approval artifact → `NEEDS_CONTEXT`.
8. **Classifier error.** `safer-diff-scope` errors out, returns non-JSON, or returns fields stamina does not know → `NEEDS_CONTEXT`.
9. **Self-invocation.** The caller modality is the authoring modality of the target artifact → `ESCALATED` (Principle 5 self-polishing).

When a stop fires, still emit `safer.stamina_gate` end with `outcome=<stop-tag>`; stop rules are telemetry-visible.

## Completion status

- `DONE` — unanimous approve across the dispatch set; consolidated comment published; label transitioned (plan mode) or deliberately left for `/safer:verify` (PR mode).
- `DONE_WITH_CONCERNS` — approve with reviewer-named concerns; each concern attributed to its source reviewer.
- `ESCALATED` — any BLOCK / `CHANGES_REQUESTED` / `ESCALATED` fired; routed upstream via Ratchet.
- `BLOCKED` — reviewer dispatch failed or external dep unresolved. Name the reviewer and the last-known state.
- `NEEDS_CONTEXT` — partial approve at ceiling, missing acceptance criteria, classifier error, or N>4 without authorization. State the question.

## Publication map

| Artifact | Destination |
|---|---|
| Per-reviewer verdict | Native to the reviewer (`gh pr review`, sub-issue comment) — stamina does not own it |
| Consolidated stamina verdict | One comment on the target PR or sub-issue |
| Label transition | `safer-transition-label` on the target sub-issue (plan mode only); PR mode leaves the PR label alone |
| Escalation | `safer-escalate --from stamina --to <authoring-mod>`; cross-linked from consolidated comment |
| Telemetry | `safer.stamina_gate` (start + end), `safer.stamina_pass` (per reviewer), `safer.skill_run` / `safer.skill_end` |

Nothing stamina produces lives outside GitHub.

## Anti-patterns

- **"I'll read the diff myself and confirm the reviewers are right."** — Iron rule violation. Stamina routes; it does not review.
- **"I'll run `/safer:review-senior` three times with different prompts to hit N=3."** — Independence rule violation. Three passes of the same skill on the same model is N=1.
- **"Two reviewers approved, one hasn't replied; I'll ship."** — Incomplete dispatch is not consensus. `BLOCKED` until the last reviewer publishes or times out.
- **"One reviewer blocked on a nit; I'll downgrade their verdict to a concern."** — Stamina does not grade reviewers. Any BLOCK routes upstream.
- **"gstack isn't present, so stamina is a no-op."** — Graceful degradation: cap at N=3 using pure-safer + `/codex` if configured. Do not skip silently.
- **"I'll invoke stamina on my own output before handing back."** — Principle 5 violation. Stamina is orchestrator-driven, not self-invoked.
- **"The consolidated comment should summarize what each reviewer found."** — No. The consolidated comment is a routing table over verdict URLs. The findings live with the reviewers.
- **"`safer-diff-scope` returned a field I do not recognize; I'll ignore it."** — Classifier drift is a real bug in the chain. `NEEDS_CONTEXT`; do not guess.
- **"The table says N=4 but the ceiling cap dropped us to 3; close enough."** — Record `n-capped=true` in telemetry; name the missing role in the consolidated comment. Silent degradation is a calibration failure.

## Checklist before declaring DONE

- [ ] Mode resolved (`--plan` or `--pr`) and target URL loaded.
- [ ] Blast radius computed; N and N-source recorded in telemetry.
- [ ] Dispatch set selected from the fixed review family; persona diversity ≥ N roles (or `n-capped=true` recorded).
- [ ] Every reviewer in the set published its native verdict to GitHub.
- [ ] Consensus computed from GitHub-read verdicts (not Agent return strings).
- [ ] Consolidated comment posted on the target.
- [ ] Label transition applied (plan mode) or deliberately skipped (PR mode, `/safer:verify` next).
- [ ] `safer.stamina_gate` end event emitted; one `safer.stamina_pass` per reviewer.
- [ ] `safer.skill_end` event emitted.
- [ ] Status marker on last line of reply.

## Escalation artifact template

```bash
safer-escalate --from stamina \
  --to <spec|architect|implement-*> \
  --cause <REVIEWER_BLOCK|IRON_RULE_FIRED|HOMOGENEOUS_DISPATCH|CLASSIFIER_ERROR|USER_BUDGET_OVERRIDE>
```

Body:

```markdown
# Escalation from stamina

**Status:** <ESCALATED|BLOCKED|NEEDS_CONTEXT>

**Cause:** <one line>

## Target
<PR or sub-issue URL>

## Dispatch set
<table: role, skill, verdict, URL>

## What the reviewers said
<verbatim per-reviewer status markers; one line each>

## What I did NOT do
- Did not read the diff or plan to synthesize a verdict.
- Did not grade or downgrade any reviewer.
- Did not retry a reviewer whose verdict I disagreed with.

## Recommended next action
- Route to <modality>, specifically <what they should decide>.

## Confidence
<LOW|MED|HIGH> — based on consensus arithmetic; stamina has no first-party evidence.
```

Post on the target; leave the consolidated comment in place; do not delete the per-reviewer verdicts.

## Voice (reminder)

See `PRINCIPLES.md > Voice`. Stamina's output is terse and structural. The consolidated comment is a routing table, not an essay. Per-reviewer findings live with the reviewer; stamina reports who ran, what they said, and the consensus outcome.

Stamina's voice is the voice of the dispatcher, not the critic. If your output reads like a review, you are in the wrong modality. The next agent reading the consolidated comment is the orchestrator (`/safer:orchestrate` Phase 5c) or the user. Write so each can route on the verdict without reconstructing your reasoning.
