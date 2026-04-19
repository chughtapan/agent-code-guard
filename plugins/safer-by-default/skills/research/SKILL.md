---
name: research
version: 0.1.0
description: |
  Run an iterative hypothesis loop on an open question with no known answer.
  Produces a ledger of claim, evidence, experiment, insight, and confidence for
  every round, closing with a final report of validated insights. Use when the
  question is open-ended ("how do X systems handle Y?", "why does Z regress
  under load?"), when literature review is load-bearing, or when the next step
  depends on answers the team does not have yet. Do NOT use when the question
  is a yes/no feasibility probe (route to /safer:spike) or when the work is to
  ship code (route to /safer:spec or /safer:implement-*).
triggers:
  - research this
  - open question
  - investigate options
  - literature review
  - how do systems handle
  - what is the state of the art
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - WebFetch
  - WebSearch
  - AskUserQuestion
---

# /safer:research

## Read first

Read `PRINCIPLES.md` at the plugin root. This skill is the projection of the principles onto **open-ended inquiry**. Specifically:

- **Principle 5 (Junior Dev Rule)** applies double here. Research that drifts into implementation work ceases to be research. Discipline is staying inside the hypothesis loop.
- **Principle 7 (Epistemic Receipt, from Artifact discipline)** is the central output. Every insight carries a confidence level and the evidence behind it. "I think so" is not a research artifact.
- **Principle 8 (Ratchet)** applies at exit. An insight matures into a spec; it does not mature into code that the research skill ships. If the next step is to write code, escalate to `/safer:spec`.
- **Artifact discipline: GitHub is the record.** The iteration ledger is published as one comment per round, so a future agent can read how the conclusion was reached.
- **Artifact discipline: Cold Start Test.** The final report is readable by an agent with no session context. "As we discussed" and "see the conversation" are anti-patterns.

## Iron rule

> **Research does not ship code. Research ships validated insights with confidence. If you are shipping code, you are in the wrong modality.**

Code may appear inside the research loop: a small probe, a measurement script, a regex run over a corpus. That code lives in scratch space and is cited in the ledger as evidence. It never merges. The output is the insight, not the script that found it.

## Role

You take one open-ended question and run it through alternating Researcher and Supervisor turns until an insight is validated at sufficient confidence, or until the round budget is exhausted.

You play both roles yourself, turn by turn, not in parallel. The separation of roles is what generates the ledger. A single-voice "here is my answer" is not research; it is assertion.

Concretely, you:

1. Frame the question in the Researcher turn.
2. Take the Supervisor turn to probe the framing.
3. Alternate: Researcher proposes, Supervisor rates.
4. Close when the Supervisor rates a round EXCELLENT with confidence at least 0.8, or when the round budget is exhausted.
5. Write the final report.
6. Publish the report as a GitHub issue with one comment per round.

## The two roles

You hold both. Switch between them one turn at a time. Each turn starts with a heading that names the role.

### Researcher turn

Each Researcher turn has exactly four parts, labelled:

- **CLAIM.** One sentence. The hypothesis under test this round.
- **EVIDENCE.** What is currently known. Sources, prior round numbers, quotations, measurements. Name each source.
- **EXPERIMENT.** What will be done this round to test the claim. May be a probe script, a targeted literature search, a reading of a specific section of a specific document, a measurement, a calculation.
- **EXPECTED.** What result would confirm the claim, and what result would reject it. If you cannot name a rejecting result, the claim is unfalsifiable; rewrite it.

Run the experiment. Then close the Researcher turn with:

- **INSIGHT.** One or two sentences. What the experiment taught.
- **IMPLICATIONS.** What this changes about the next round, or about the final answer.
- **CONFIDENCE.** A number from 0.0 to 1.0, plus a one-sentence justification.

### Supervisor turn

The Supervisor never solves. The Supervisor asks Socratic questions that stress-test the Researcher's output. Format:

- **QUESTIONS.** Three to five short questions that attack the weakest points of the Researcher turn. Pick the hardest questions you can find; the Supervisor's job is not to be nice.
- **RATING.** One of EXCELLENT / GOOD / FAIR / POOR. Rubric:
  - **EXCELLENT.** Claim is sharp. Evidence is named and verifiable. Experiment actually tests the claim. Insight follows from the experiment. Confidence is calibrated.
  - **GOOD.** One of the four is shaky; the rest are solid. Insight is directionally right.
  - **FAIR.** Two are shaky. The round produced learning but needs another pass.
  - **POOR.** The round did not advance the question. Restart.
- **GUIDANCE.** One sentence on what the next Researcher turn should do differently. Not a solution; a direction.

The Supervisor does not propose the next claim. That is the Researcher's turn.

## Inputs required

- One open-ended question from the user. The question does not have to be well-formed; the first round will refine it.
- A round budget. Default: 20 rounds. The budget is a cap on cost and also a stop rule.
- A confidence target. Default: EXCELLENT rating with a numeric confidence of at least 0.8.
- Optional prior context: existing issues, prior research, documents the user references. Read before the first Researcher turn.

### Preamble (run first)

```bash
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated"; exit 1; }
eval "$(safer-slug 2>/dev/null)" || true
SESSION="$$-$(date +%s)"
_TEL_START=$(date +%s)
safer-telemetry-log --event-type safer.skill_run --modality research --session "$SESSION" 2>/dev/null || true
_UPD=$(safer-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD"
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "unknown/unknown")
echo "REPO:    $REPO"
echo "SESSION: $SESSION"
echo "ROUNDS:  0 / 20"
```

If any `safer-*` binary is missing, continue without it. Telemetry is optional.

## Scope

**In scope:**
- Framing and reframing the question as the Researcher turn.
- Running experiments: targeted code probes, literature reads via `WebFetch` / `WebSearch`, measurements, calculations.
- Rating your own rounds in the Supervisor turn, strictly against the rubric.
- Writing each round to a local ledger file and publishing as a comment on the research issue.
- Writing the final report once the loop closes.

**Forbidden:**
- Shipping code. Probe scripts in the research loop are evidence, not artifacts; they never merge.
- Skipping the Supervisor turn. Round is not complete without a rating.
- Grading your own work leniently. A GOOD round is not EXCELLENT; name it GOOD and take another round.
- Accepting a HIGH-confidence insight without reproducible evidence. HIGH requires the evidence to hold on a second look.
- Expanding the question mid-loop. A new question is a new research issue.
- Reaching for implementation when an insight matures. That is escalation to `/safer:spec`, not continuation here.

## Scope budget

- **One question.** Framed in round 1; frozen after round 2.
- **Up to 20 rounds.** The budget is per-question. If you hit 20 without an EXCELLENT, the modality emits `DONE_WITH_CONCERNS` with the unresolved hypotheses named.
- **Confidence target: EXCELLENT rating with numeric confidence at least 0.8.** Below the target, keep going. At or above, close.
- **Ledger grows monotonically.** Old rounds are never rewritten. If a later round invalidates an earlier claim, the later round says so explicitly; the earlier round stays in the ledger as the record of what was thought.

## Workflow

### Phase 1: Publish the research issue

Before any rounds, create the issue that will hold the ledger.

```bash
TMP=$(mktemp)
cat > "$TMP" <<EOF
# Research: <compressed question>

## Question
<the user's question, lightly cleaned>

## Round budget
20

## Confidence target
EXCELLENT with numeric confidence at least 0.8

## Session
$SESSION
EOF

URL=$(safer-publish --kind issue \
  --title "[safer:research] <short framing>" \
  --body-file "$TMP" \
  --labels "safer:research,planning")
ISSUE=$(echo "$URL" | grep -oE '[0-9]+$')
echo "Research issue: $URL"
rm -f "$TMP"
```

Transition the label: `safer-transition-label --issue "$ISSUE" --from planning --to implementing` (the "implementing" label is overloaded here to mean "the loop is running"; the state model has no "researching" state).

### Phase 2: The loop

The Supervisor role is **codex** (cross-model independent evaluation). Run `/codex --mode supervisor` on the Researcher turn output before writing the Supervisor turn. If `/codex` is unavailable, fall back to the internal Supervisor turn and log the skip on the sub-issue.

For each round, do the following five steps:

1. **Researcher turn.** Write the four-part turn (CLAIM, EVIDENCE, EXPERIMENT, EXPECTED) to a scratch file, run the experiment, then fill in INSIGHT, IMPLICATIONS, CONFIDENCE.
2. **Codex supervisor gate.** Run `/codex --mode supervisor` on the Researcher output. Codex stamps `continue` / `hold` / `escalate`. `hold` → Researcher revises the same round before advancing. `escalate` → treat as a POOR round and emit `NEEDS_CONTEXT` to the caller. `continue` → proceed.
3. **Supervisor turn.** Write QUESTIONS, RATING, GUIDANCE (informed by the codex stamp).
4. **Publish the round.** Post the concatenated Researcher + codex stamp + Supervisor turns as a comment on the research issue. Each round is one comment; comments are the ledger.
5. **Check exit conditions.** If Supervisor rated EXCELLENT and Researcher confidence is at least 0.8, exit the loop. If round count equals 20, exit with `DONE_WITH_CONCERNS`. Else, increment round and continue.

Comment template for a round:

```markdown
## Round <N>

### Researcher
**CLAIM.** <one sentence>
**EVIDENCE.** <named sources>
**EXPERIMENT.** <what the round did>
**EXPECTED.** <confirming result> ; <rejecting result>

<probe output, literature quotes, or measurements>

**INSIGHT.** <one or two sentences>
**IMPLICATIONS.** <what this changes>
**CONFIDENCE.** <0.0 to 1.0> ; <justification>

### Codex supervisor
**STAMP.** <continue | hold | escalate>
**NOTE.** <one sentence from codex, or "unavailable — skipped" if /codex not installed>

### Supervisor
**QUESTIONS.**
1. <question>
2. <question>
3. <question>

**RATING.** <EXCELLENT | GOOD | FAIR | POOR>
**GUIDANCE.** <one sentence>
```

### Phase 3: Experiments

Experiments in research are usually one of:

- **Literature review.** Use `WebFetch` / `WebSearch` to read named sources. Quote the passage that supports or refutes the claim; link the source.
- **Corpus probe.** Run a measurement script over a codebase, a dataset, a log, a set of issues. Script lives in `research/<slug>/` and is cited from the ledger. Never merged.
- **Reading.** Read a specific section of a specific document in the repo or on the web.
- **Calculation.** Compute a number the claim depends on. Show the work.

Craft principles (types, schemas, typed errors, exhaustiveness) are suspended for probe scripts, same as in `/safer:spike`. Scripts are evidence. They never ship.

### Phase 4: Final report

When the loop exits (either EXCELLENT at >= 0.8, or budget exhausted), write the final report. Structure:

```markdown
# Research report: <question>

## Question (final framing)
<one or two sentences>

## Answer
<the distilled insight or set of insights>

## Confidence
<HIGH | MED | LOW> ; <one sentence>

## Validated insights
- <insight>. Source: round <N>.
- <insight>. Source: round <N>.

## Rejected hypotheses
- <hypothesis>. Rejected in round <N> because <reason>.

## Open questions
- <question that this research did not resolve>. Recommended modality: <research | spike | spec>.

## Recommended next modality
<one of: spec, architect, spike, research (new issue), none>. Reason: <one sentence>.

## Ledger
Rounds 1 to <N>. See comments on this issue.
```

Post as a new comment on the research issue, then edit the issue body to link to the final report comment so the report is above the fold.

### Phase 5: Close out

```bash
safer-transition-label --issue "$ISSUE" --from implementing --to done
safer-telemetry-log --event-type safer.skill_end --modality research \
  --session "$SESSION" --outcome success \
  --duration-s "$(($(date +%s) - _TEL_START))" 2>/dev/null || true
```

If the research matured into a spec-ready artifact, hand off via the graduation statement in the report. Do not write the spec yourself. That is `/safer:spec`.

## Stop rules

Each stop rule ends with an escalation artifact via `safer-escalate --from research --to <target> --cause <CAUSE>`.

1. **Round budget exhausted without EXCELLENT.** Emit `DONE_WITH_CONCERNS`. Name each hypothesis that was advanced but not settled. Target: caller (user or `orchestrate`).
2. **User input contradicts a working hypothesis.** A mid-loop user comment rejects a claim the loop has been building on. Emit `NEEDS_CONTEXT`, reconcile with the user, then resume.
3. **The answer requires shipping code.** The research matured past insight into implementation. Emit `ESCALATED` to `/safer:spec`. Do not ship the code yourself.
4. **Unfalsifiable claim.** A round produces a claim you cannot name a rejecting result for. Stop, reformulate the claim, count as a POOR round.
5. **Three consecutive POOR rounds.** The question is mis-framed. Emit `ESCALATED` to caller for reframing.

## Completion status

Every invocation ends with exactly one status marker.

- `DONE` ; EXCELLENT rating reached at or above 0.8 confidence; final report posted; next modality named.
- `DONE_WITH_CONCERNS` ; round budget exhausted; at least one hypothesis remains unresolved; final report names it.
- `ESCALATED` ; a stop rule fired (shipping code required, or three consecutive POOR, or user contradicted a working hypothesis). Escalation artifact published.
- `BLOCKED` ; research requires an external dependency (access, data, subject-matter expert) that is not available. Name it.
- `NEEDS_CONTEXT` ; user-resolvable ambiguity blocks the next round. State the question.

## Escalation artifact template

Emit via `safer-escalate --from research --to <target> --cause <CAUSE>`.

```markdown
# Escalation from research

**Status:** <ESCALATED | BLOCKED | NEEDS_CONTEXT | DONE_WITH_CONCERNS>

**Cause:** <one line>

## Context
- Research issue: #<N>
- Rounds completed: <M> / 20
- Current framing: <one sentence>

## What has been validated
- <insight>. Round <N>. Confidence <X>.

## What is unresolved
- <hypothesis>. Blocked by <cause>.

## Recommended next action
- <one action: reframe, new modality, user input needed>

## Confidence
<LOW | MED | HIGH> ; <evidence>
```

Post the artifact as a comment on the research issue.

## Publication map

| Artifact | Destination | Label |
|---|---|---|
| Research issue (container) | New GitHub issue | `safer:research,planning` |
| Per-round ledger entries | Comments on the research issue | not applicable |
| Final report | Comment on the research issue; linked from issue body | not applicable |
| Probe scripts | `research/<slug>/` on a scratch branch, referenced from ledger entries | not applicable |
| Escalation artifact | Comment on the research issue | not applicable |

The probe scripts are never merged. They can be deleted after the final report is accepted.

## Anti-patterns

- **"This round was close to EXCELLENT; I will rate it EXCELLENT to save a round."** Self-grading leniency. The rubric is the rubric. Close is GOOD.
- **"I will skip the Supervisor turn this round; the Researcher was clearly right."** The Supervisor turn is what distinguishes research from assertion. Skipping it collapses the ledger to one voice.
- **"I found the answer in round 3; no point continuing."** If round 3 was EXCELLENT at 0.8+, exit. Otherwise the answer is provisional; keep probing.
- **"Let me just write the spec while I am at it."** Ratchet violation. Escalate. Do not absorb downstream modalities into the loop.
- **"The research shipped a probe script to main."** Forbidden. Probe scripts live in scratch, are cited in the ledger, and are deleted or archived after the report.
- **"Confidence HIGH, evidence: `I reviewed the literature`."** Evidence must name sources. Generic references do not count.
- **"Rounds 5 through 9 were similar to round 4; I will collapse them."** The ledger is monotonic. If rounds were redundant, say so explicitly in round 5 and stop repeating.

## Checklist before declaring `DONE`

- [ ] The research issue exists with label `safer:research,done`.
- [ ] Every round from 1 to N is a distinct comment on the issue, in order.
- [ ] Each round has both a Researcher turn (CLAIM / EVIDENCE / EXPERIMENT / EXPECTED / INSIGHT / IMPLICATIONS / CONFIDENCE) and a Supervisor turn (QUESTIONS / RATING / GUIDANCE).
- [ ] The final round carried RATING EXCELLENT and CONFIDENCE at least 0.8, or the report is marked `DONE_WITH_CONCERNS`.
- [ ] The final report is posted as a comment and linked from the issue body.
- [ ] The next modality is named, or the report says "none".
- [ ] `safer.skill_end` event emitted.
- [ ] Status marker on the last line of the reply.

If any box is unchecked, the status is not `DONE`.

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

See `PRINCIPLES.md` voice section. The ledger is dense. Numbers over adjectives. Named sources over gestures. The Researcher voice is confident; the Supervisor voice is adversarial. Both are direct. The next agent reading the ledger wants the CLAIM / RATING structure, not prose narration. Give them the structure.
