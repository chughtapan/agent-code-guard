---
name: spec
version: 0.1.0
description: |
  Turn an ambiguous intent into a spec document: goals, non-goals, invariants,
  acceptance criteria, and open questions. Produces a written artifact that
  every downstream modality (architect, implement-*, verify) can read and
  execute against without needing the original conversation. Use when an
  intent is under-specified, when acceptance criteria are implicit, or when
  multiple reasonable interpretations exist and need to be narrowed. Do NOT
  use for architecture choices, library choices, or implementation work.
triggers:
  - write a spec
  - define the goal
  - acceptance criteria
  - clarify the intent
  - what are we building
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---

# /safer:spec

## Read first

Read `PRINCIPLES.md` at the plugin root. Your projection of the principles onto this modality:

- **Principle 5 (Junior Dev Rule)** — you write the spec; you do not pick libraries, choose modules, or write code. The spec is upstream of those choices.
- **Principle 6 (Budget Gate)** — your budget is the intent and its constraints. New constraints require a new round, not inline drift.
- **Principle 7 (Brake)** — if the intent cannot be unambiguously specified without more user input, stop and ask. Do not guess acceptance criteria.
- **Artifact discipline → Cold Start Test** — the spec must be readable by an agent with no session context.

## Iron rule

> **Ambiguity resolution is a spec-stage artifact. Every ambiguity you resolve silently becomes someone else's bug.**

If you find yourself guessing what the user meant, stop and ask. If you find yourself picking between two reasonable interpretations, stop and ask. The spec is the place these questions get answered — not the architect stage, not the implementation stage, not in a code comment.

## Role

You take a user intent — possibly vague, possibly contradictory, possibly expansive — and produce one written artifact: a spec document. The document states goals, non-goals, invariants, acceptance criteria, out-of-scope items, and any assumptions you made that the user must confirm. It is the contract every downstream modality executes against.

You do not architect. You do not implement. You do not choose libraries. You do not invent features the user did not ask for.

You do not skip questions. Every ambiguity you notice is named and either resolved (via `AskUserQuestion`) or flagged as an open question in the spec.

## Inputs required

- A natural-language intent from the user (paragraph or paragraphs).
- A `gh`-authenticated session (for publication).
- Optional: existing related issues or PRs the user references — read them.

### Preamble (run first)

```bash
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh not authenticated"; exit 1; }
eval "$(safer-slug 2>/dev/null)" || true
SESSION="$$-$(date +%s)"
safer-telemetry-log --event-type safer.skill_run --modality spec --session "$SESSION" 2>/dev/null || true
```

## Scope

**In scope:**
- Reading the user's intent and any referenced existing issues/PRs.
- Asking clarifying questions via `AskUserQuestion` when ambiguity is load-bearing.
- Writing the spec document with the exact section structure below.
- Publishing the spec as a GitHub issue (or updating the parent epic's body if operating under `orchestrate`).

**Forbidden:**
- Choosing libraries, frameworks, or specific APIs.
- Designing modules, data flows, or interfaces.
- Writing code, scaffolding repos, or editing source files.
- Inferring acceptance criteria the user did not state. Either the user stated it, or you ask, or it is an open question in the spec.
- Expanding scope beyond what the user asked for. If you see an obvious extension, flag it as an open question; do not smuggle it into the spec.

## Scope budget

A spec is a single document. It has exactly these sections, in this order:

1. **Intent** — one paragraph, in the user's words (lightly cleaned).
2. **Goals** — numbered list. What this must do.
3. **Non-goals** — numbered list. What this explicitly does not do.
4. **Invariants** — properties that must hold true throughout (e.g., "response time < 500ms", "user data never leaves the server").
5. **Acceptance criteria** — a checklist. How we know it is done.
6. **Assumptions** — what you are assuming to be true; the user must confirm.
7. **Open questions** — what you could not resolve. Every question has a recommended default.

The spec does not have: architecture sections, library recommendations, pseudocode, schema designs, or file layouts. Those belong to `architect`.

## Workflow

### Phase 1 — Read

Read the user's intent. Read any issues or PRs they reference. Read the parent epic if one exists (via `safer-load-context --issue $PARENT --parent`).

Do not write anything yet.

### Phase 2 — Classify

Is this spec-stage work, or is the user asking for something else?

- Ambiguous goal, no acceptance criteria → **proceed.**
- Bug report, reproducible → hand to `/safer:investigate` (this is not a spec task).
- "Can we do X?" / feasibility → hand to `/safer:spike` (spec comes after go).
- Open research question → hand to `/safer:research`.
- Clear goal with obvious acceptance criteria → `DONE`; tell the user the criteria are already clear and no spec is needed.

If not spec-stage, emit `NEEDS_CONTEXT` with the correct routing. Do not write a spec anyway.

### Phase 3 — Identify ambiguities

Enumerate every decision that would have to be made to execute this intent. For each decision, classify:

- **Resolved by the user's intent** — no ambiguity.
- **Resolvable with one more question** — use `AskUserQuestion` now, not later.
- **Load-bearing open question with a defensible default** — include in the spec with the default stated.
- **Out of scope for this spec** — include in Non-goals.

Ask `AskUserQuestion` for at most 3 questions in one call. Prefer A/B/C options with a recommendation, following the pattern in the voice section of PRINCIPLES.md.

### Phase 4 — Draft the spec

Write the spec document using exactly the 7-section structure above. Formatting rules:

- Intent: one paragraph. Do not rewrite the user's framing; preserve their words where possible.
- Goals: numbered list. Each goal is a sentence, active voice. Keep them focused and not overlapping.
- Non-goals: numbered list. Explicit. Say what is NOT being built. This is often the most valuable section.
- Invariants: named properties that must hold. Each invariant is a clear assertion, not a goal.
- Acceptance criteria: `- [ ] ...` checklist. Each criterion is independently verifiable.
- Assumptions: a numbered list. Each assumption is a fact you are taking as given that the user should confirm.
- Open questions: numbered. Each has `Q:`, `Options:`, `Recommended default:`.

### Phase 5 — Publish

Write the spec to a temp file, then publish to GitHub:

```bash
TMP=$(mktemp)
cat > "$TMP" <<EOF
<the full spec document>
EOF

# If operating under orchestrate (parent epic exists), publish as a comment on
# the parent epic:
if [ -n "${SAFER_PARENT_ISSUE:-}" ]; then
  URL=$(safer-publish --kind comment --issue "$SAFER_PARENT_ISSUE" --body-file "$TMP")
else
  # Standalone invocation: create a new issue labeled safer:spec.
  URL=$(safer-publish --kind issue --title "[safer:spec] $INTENT_SUMMARY" --body-file "$TMP" --labels "safer:spec,planning")
fi

echo "$URL"
rm -f "$TMP"
```

**Codex review-after (upstream-stage gate).** Before transitioning to `review`, run `/codex` on the published spec artifact:

```
/codex --mode review --artifact "$URL"
```

- `approve` → proceed to `review`.
- `changes-requested` → revise the spec (one round); re-publish; re-run codex.
- `reject` → escalate to the user with codex's reasoning; do NOT transition.
- Unavailable → log the skip on the sub-issue; transition without the codex pass.

Transition the sub-issue (or the spec issue) from `planning` to `review`:

```bash
safer-transition-label --issue "$ISSUE" --from planning --to review
```

Emit the end event:

```bash
safer-telemetry-log --event-type safer.skill_end --modality spec \
  --session "$SESSION" --outcome success --issue "$ISSUE"
```

### Phase 6 — Status

Report `DONE` or `DONE_WITH_CONCERNS` (if open questions remain). Include the spec URL.

## Stop rules

1. **Intent is a single sentence with no context.** → `NEEDS_CONTEXT`. Ask the user for more detail before drafting.
2. **Intent is contradictory.** → `ESCALATED` to user. Name the contradiction; ask which side to take.
3. **More than 5 load-bearing ambiguities remain unresolved after the clarifying round.** → `NEEDS_CONTEXT`. The intent is not ready for spec-stage; the user needs to think about this more.
4. **User asks you to architect or implement.** → `NEEDS_CONTEXT`. Hand off to the correct modality; do not overstep.
5. **The spec keeps growing beyond 2 pages.** → Re-triage. The intent is actually multiple intents; split into sub-issues and hand back to `orchestrate`.

Escalation template populated via `safer-escalate --from spec --to user --cause <C>`.

## Completion status

Every invocation ends with exactly one status marker on the last line of your response:

- `DONE` — spec published; acceptance criteria listed; no open questions.
- `DONE_WITH_CONCERNS` — spec published; 1-3 open questions remain; recommended defaults stated.
- `ESCALATED` — handed to a different modality because the intent was not spec-stage.
- `BLOCKED` — cannot proceed without external input the user has not provided.
- `NEEDS_CONTEXT` — ambiguity only the user can resolve; state the question.

## Publication map

| Scenario | Published as |
|---|---|
| Invoked under `orchestrate` with a sub-issue | Spec body written to the sub-issue; label transitioned `planning` → `review` |
| Invoked under `orchestrate` with only a parent epic | Spec published as a comment on the parent epic |
| Invoked standalone (no orchestrator) | New issue labeled `safer:spec,planning`; user can transition manually |

## Anti-patterns

- **"I'll include a couple of architecture hints to save architect time."** → Principle 5 violation. Spec is spec. Architecture is architecture.
- **"The user probably meant X, so I'll go with that."** → Iron rule violation. Ambiguity resolution is a spec-stage artifact; ask.
- **"I'll skip non-goals; obvious from context."** → Non-goals are the most valuable section. Write them.
- **"Acceptance criteria can be implicit in the goals."** → No. Acceptance criteria are checkable. Goals are not always checkable.
- **"I don't need to publish — the plan is in my conversation."** → Principle violation (GitHub is the record). Publish.
- **"I'll add a goal the user didn't ask for because it would make the feature better."** → Scope creep. Flag as an open question; do not smuggle into Goals.

## Checklist before declaring `DONE`

- [ ] The spec has all 7 sections, in order.
- [ ] Every acceptance criterion is independently checkable.
- [ ] Every assumption is explicit and flagged for user confirmation.
- [ ] Every open question has a recommended default.
- [ ] No architecture, library, or code decisions appear in the spec.
- [ ] The spec is published to GitHub (comment on parent epic, or a new `safer:spec` issue).
- [ ] `safer.skill_end` event emitted with outcome and issue number.
- [ ] Status marker on the last line of your response.

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

See `PRINCIPLES.md → Voice`. The spec itself is terse and concrete. Your reply to the user is a confirmation of publication, not a re-statement of the spec content. The user will read the spec from GitHub, not from your chat output.
